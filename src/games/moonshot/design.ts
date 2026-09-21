/**
 * Moonshot's workshop: a grid you can put anything anywhere on.
 *
 * There are no levels and nothing is locked. Every part is on the shelf from the first second, and
 * the only thing standing between a child and a better rocket is whether they have worked out what
 * makes one. That is the whole design: the rules below are the teacher, not a progress bar.
 *
 * The grid is one part wide per column and one cell per row. A part sits in a column and stands on
 * a row, and that is all the geometry there is - which means a five-year-old can drop a booster
 * beside the core without being told what a booster is, and a nine-year-old can build a nine-column
 * monster and find out why it does not work.
 *
 * Everything downstream reads from this file: what it weighs, what it pushes with, when each piece
 * falls away, and how hard the air fights it.
 */

// ---------------------------------------------------------------- the grid

export const COLS = 9;
export const ROWS = 26;
export const CENTRE = 4;
/** More than this and the screen cannot show it, never mind a child keeping track of it. */
export const MAX_PARTS = 60;

/** One column of the grid, in metres. The tanks set it: see the note on tank volumes below. */
export const UNIT_M = 1.8;

// ---------------------------------------------------------------- the parts

export type Group = 'top' | 'tank' | 'engine' | 'booster' | 'extra';
export type Kind = 'nose' | 'pod' | 'tank' | 'engine' | 'solid' | 'fin' | 'truss';

export interface Part {
  id: string;
  kind: Kind;
  group: Group;
  name: string;
  nameNl: string;
  /** how many grid rows tall */
  rows: number;
  /** how wide it is drawn and how wide the air feels it, where one column is 1.0 */
  w: number;
  /** empty mass, tonnes */
  dry: number;
  /** fuel carried, tonnes */
  fuel: number;
  /** tonnes burnt per second at full throttle */
  burn: number;
  /** exhaust speed, metres per second: the quality of an engine */
  exhaust: number;
  /** how pointed the top of it is, 0 for a flat lid and 1 for a needle */
  sharp: number;
  /**
   * How much of the circle its width implies the air actually meets.
   *
   * A part as wide as three tubes side by side is not a disc three tubes across - it is three
   * discs, which is a third of the area. A shuttle is mostly flat wing. Everything that really is
   * a cylinder leaves this at one.
   */
  bulk: number;
  /** which drawing this part uses; defaults to something sensible for its kind */
  art?: string;
  /** how many nozzles an engine shows */
  bells?: number;
  /** how many casings a strap-on booster is made of */
  tubes?: number;
  /** one line about what it is for */
  note: string;
  noteNl: string;
}

const P = (p: Partial<Part> & Pick<Part, 'id' | 'kind' | 'group' | 'name' | 'nameNl' | 'note' | 'noteNl'>): Part => ({
  rows: 1, w: 1, dry: 0, fuel: 0, burn: 0, exhaust: 3000, sharp: 0, bulk: 1, ...p,
});

/**
 * Twenty-four parts, and every single one of them a trade.
 *
 * The tank volumes are real. One column is 1.8 m across and one row is 1.8 m tall, so a two-row
 * small tank is a cylinder of about 9 cubic metres - right for four and a half tonnes of kerosene
 * and liquid oxygen with ullage left at the top. The drawing and the numbers are the same rocket.
 *
 * The burn rates are set so a rocket lifts off at a believable thrust-to-weight and the burn
 * lasts long enough to watch and steer, rather than leaping off the pad and being over in twenty
 * seconds. Fuel and exhaust speed are untouched, so how far a rocket goes is unchanged - only how
 * long it takes to get there.
 *
 * The engines differ in two ways at once, which is the thing worth learning. Thrust gets you off
 * the ground. Exhaust speed decides how far you end up going. The big engine pushes nearly four
 * times harder than the small one and will never take you as far as the quiet vacuum engine, and
 * the nuclear engine pushes less than the big one and beats everything. NASA built and fired that
 * engine in the sixties and its exhaust really was about twice as fast as the best chemical one.
 */
/**
 * A hundred and three parts, and every number in them follows a rule.
 *
 * A tank's fuel is its volume: 2.75 tonnes per unit of width squared times height, which is why a
 * wide tank holds so much more than a tall thin one and why the air hates it for exactly the same
 * reason. Its empty mass is four per cent of what it carries plus a lump for the plumbing, except
 * for the shapes where that is not true: a sphere is the lightest skin for a volume, a balloon
 * tank is thinner still, a pressure tank is thicker.
 *
 * An engine is given a thrust and an exhaust speed, both real, and the burn rate falls out of
 * them. Thrust gets you off the ground; exhaust speed decides how far you end up going, which is
 * why the quiet vacuum engine beats the loud turbo and why the nuclear engine beats everything.
 * NASA built and fired that one in the sixties.
 *
 * `bulk` is how much of the circle a part's width implies the air actually meets: a row of three
 * tubes is three discs, not one enormous one, and a solar panel is a sheet.
 */
export const PARTS: Part[] = [
  // ---- what rides on top, and what caps a column
  P({
    id: 'nose-xs', kind: 'nose', group: 'top', name: 'Tiny cone', nameNl: 'Puntje',
    rows: 1, w: 0.62, dry: 0.05, sharp: 1,
    note: 'For a slim booster. Weighs almost nothing.',
    noteNl: 'Voor een smalle booster. Weegt bijna niets.',
    art: 'cone',
  }),
  P({
    id: 'nose', kind: 'nose', group: 'top', name: 'Nose cone', nameNl: 'Neuskegel',
    rows: 1, w: 1, dry: 0.1, sharp: 1,
    note: 'Almost weightless, and the air slides off it. Put one on every column.',
    noteNl: 'Bijna geen gewicht, en de lucht glijdt eraf. Zet er een op elke kolom.',
    art: 'cone',
  }),
  P({
    id: 'nose-l', kind: 'nose', group: 'top', name: 'Wide cone', nameNl: 'Brede kegel',
    rows: 2, w: 1.4, dry: 0.22, sharp: 1,
    note: 'Caps a wide stack without a step.',
    noteNl: 'Sluit een brede stapel af zonder richel.',
    art: 'cone',
  }),
  P({
    id: 'nose-xl', kind: 'nose', group: 'top', name: 'Huge cone', nameNl: 'Reuzekegel',
    rows: 2, w: 1.8, dry: 0.36, sharp: 1,
    note: 'For the very widest tanks.',
    noteNl: 'Voor de allerbreedste tanks.',
    art: 'cone',
  }),
  P({
    id: 'nose-sharp', kind: 'nose', group: 'top', name: 'Needle cone', nameNl: 'Naaldkegel',
    rows: 2, w: 1, dry: 0.16, sharp: 1,
    note: 'Long and pointed. The best nose in the game, and you feel it.',
    noteNl: 'Lang en spits. De beste neus in het spel, en dat merk je.',
    art: 'needle',
  }),
  P({
    id: 'nose-blunt', kind: 'nose', group: 'top', name: 'Blunt cap', nameNl: 'Stompe kap',
    rows: 1, w: 1, dry: 0.07, sharp: 0.55,
    note: 'Cheap and short. Better than a flat lid, worse than a cone.',
    noteNl: 'Goedkoop en kort. Beter dan een platte deksel, slechter dan een kegel.',
    art: 'blunt',
  }),
  P({
    id: 'fairing-s', kind: 'nose', group: 'top', name: 'Small fairing', nameNl: 'Kleine neuskap',
    rows: 2, w: 1.15, dry: 0.4, sharp: 0.85,
    note: 'A shell over something slightly too wide.',
    noteNl: 'Een kap over iets dat net iets te breed is.',
    art: 'fairing',
  }),
  P({
    id: 'fairing', kind: 'nose', group: 'top', name: 'Fairing', nameNl: 'Neuskap',
    rows: 2, w: 1.38, dry: 0.6, sharp: 0.85,
    note: 'A wide shell to hide something fat under. Falls away with the stage.',
    noteNl: 'Een brede kap om iets diks onder te verstoppen. Valt met de trap mee af.',
    art: 'fairing',
  }),
  P({
    id: 'fairing-l', kind: 'nose', group: 'top', name: 'Big fairing', nameNl: 'Grote neuskap',
    rows: 3, w: 1.75, dry: 1.0, sharp: 0.85,
    note: 'Room for a whole lander inside it.',
    noteNl: 'Er past een hele lander in.',
    art: 'fairing',
  }),
  P({
    id: 'heatshield', kind: 'nose', group: 'top', name: 'Heat shield', nameNl: 'Hitteschild',
    rows: 1, w: 1.4, dry: 0.7, sharp: 0.35, bulk: 1,
    note: 'A blunt dish of ablative tiles. Heavy, and it does not cut the air.',
    noteNl: 'Een stompe schaal van hittetegels. Zwaar, en snijdt de lucht niet.',
    art: 'shield',
  }),
  P({
    id: 'probe', kind: 'pod', group: 'top', name: 'Probe', nameNl: 'Sonde',
    rows: 1, w: 0.7, dry: 0.25, sharp: 0.8,
    note: 'The lightest thing you can send. Nothing rides home in it.',
    noteNl: 'Het lichtste wat je kunt versturen. Er komt niemand mee terug.',
    art: 'probe',
  }),
  P({
    id: 'probe-l', kind: 'pod', group: 'top', name: 'Big probe', nameNl: 'Grote sonde',
    rows: 1, w: 1, dry: 0.5, sharp: 0.75,
    note: 'More instruments, more mass.',
    noteNl: 'Meer instrumenten, meer massa.',
    art: 'probe',
  }),
  P({
    id: 'sat', kind: 'pod', group: 'top', name: 'Satellite', nameNl: 'Satelliet',
    rows: 1, w: 0.9, dry: 0.6, sharp: 0.5,
    note: 'A box with a dish. It wants to be left somewhere high.',
    noteNl: 'Een kast met een schotel. Wil ergens hoog achterblijven.',
    art: 'sat',
  }),
  P({
    id: 'telescope', kind: 'pod', group: 'top', name: 'Telescope', nameNl: 'Telescoop',
    rows: 2, w: 1, dry: 1.4, sharp: 0.6,
    note: 'A mirror in a tube, for looking further than anyone has.',
    noteNl: 'Een spiegel in een koker, om verder te kijken dan wie ook.',
    art: 'scope',
  }),
  P({
    id: 'capsule', kind: 'pod', group: 'top', name: 'Capsule', nameNl: 'Capsule',
    rows: 2, w: 0.9, dry: 0.8, sharp: 0.9,
    note: 'Room for one. Never falls away - it is what you are sending.',
    noteNl: 'Plek voor een. Valt nooit af: het is wat je verstuurt.',
    art: 'capsule',
  }),
  P({
    id: 'capsule-l', kind: 'pod', group: 'top', name: 'Three-seat capsule', nameNl: 'Driezitscapsule',
    rows: 2, w: 1.2, dry: 1.6, sharp: 0.85,
    note: 'Room for three, and it weighs like it.',
    noteNl: 'Plek voor drie, en zo voelt het ook.',
    art: 'capsule',
  }),
  P({
    id: 'cabin', kind: 'pod', group: 'top', name: 'Big cabin', nameNl: 'Grote cabine',
    rows: 3, w: 1.1, dry: 2.2, sharp: 0.7,
    note: 'Room for a crew, and it weighs what a crew weighs.',
    noteNl: 'Plek voor een bemanning, en het weegt wat een bemanning weegt.',
    art: 'cabin',
  }),
  P({
    id: 'station', kind: 'pod', group: 'top', name: 'Station module', nameNl: 'Stationmodule',
    rows: 3, w: 1.35, dry: 3.6, sharp: 0.55,
    note: 'A room to live in, up there. Very heavy.',
    noteNl: 'Een kamer om daarboven in te wonen. Heel zwaar.',
    art: 'station',
  }),
  P({
    id: 'lander', kind: 'pod', group: 'top', name: 'Lander', nameNl: 'Lander',
    rows: 2, w: 1.15, dry: 1.8, sharp: 0.5,
    note: 'Legs and a hatch, for setting down on something.',
    noteNl: 'Poten en een luik, om op iets neer te zetten.',
    art: 'lander',
  }),
  P({
    id: 'rover', kind: 'pod', group: 'top', name: 'Rover', nameNl: 'Rover',
    rows: 1, w: 1.25, dry: 0.9, sharp: 0.3, bulk: 0.7,
    note: 'Wheels for somewhere else. Flat, wide and awkward in the air.',
    noteNl: 'Wielen voor ergens anders. Plat, breed en lastig in de lucht.',
    art: 'rover',
  }),
  P({
    id: 'cargo', kind: 'pod', group: 'top', name: 'Cargo bay', nameNl: 'Laadruim',
    rows: 2, w: 1.2, dry: 1.1, sharp: 0.4,
    note: 'An empty hold. Honest about it: it is mass and nothing else.',
    noteNl: 'Een leeg ruim. Eerlijk gezegd: het is massa en verder niets.',
    art: 'cargo',
  }),
  P({
    id: 'shuttle', kind: 'pod', group: 'top', name: 'Space shuttle', nameNl: 'Spaceshuttle',
    rows: 4, w: 1.5, dry: 6, sharp: 0.55, bulk: 0.56,
    note: 'Rides on the side of the tank, the way the real one did. Its engines go under the tank.',
    noteNl: 'Gaat aan de zijkant van de tank mee, zoals de echte. De motoren zet je onder de tank.',
    art: 'shuttle',
  }),
  P({
    id: 'shuttle-s', kind: 'pod', group: 'top', name: 'Mini shuttle', nameNl: 'Minishuttle',
    rows: 3, w: 1.2, dry: 3, sharp: 0.55, bulk: 0.56,
    note: 'A small winged body. Lighter than the big one and just as awkward.',
    noteNl: 'Een klein gevleugeld lijf. Lichter dan de grote en net zo lastig.',
    art: 'shuttle',
  }),

  // ---- tanks: fuel is volume, and volume is width squared times height
  P({
    id: 'tank-t1', kind: 'tank', group: 'tank', name: 'Thin tank 1', nameNl: 'Smalle tank 1',
    rows: 1, w: 0.62, fuel: 1.06, dry: 0.09,
    note: '1.06 tonnes of fuel, 1 rows tall.',
    noteNl: '1,06 ton brandstof, 1 rijen hoog.',
  }),
  P({
    id: 'tank-t2', kind: 'tank', group: 'tank', name: 'Thin tank 2', nameNl: 'Smalle tank 2',
    rows: 2, w: 0.62, fuel: 2.11, dry: 0.13,
    note: '2.11 tonnes of fuel, 2 rows tall.',
    noteNl: '2,11 ton brandstof, 2 rijen hoog.',
  }),
  P({
    id: 'tank-thin', kind: 'tank', group: 'tank', name: 'Thin tank 3', nameNl: 'Smalle tank 3',
    rows: 3, w: 0.62, fuel: 3.17, dry: 0.18,
    note: '3.17 tonnes of fuel, 3 rows tall.',
    noteNl: '3,17 ton brandstof, 3 rijen hoog.',
  }),
  P({
    id: 'tank-t4', kind: 'tank', group: 'tank', name: 'Thin tank 4', nameNl: 'Smalle tank 4',
    rows: 4, w: 0.62, fuel: 4.23, dry: 0.22,
    note: '4.23 tonnes of fuel, 4 rows tall.',
    noteNl: '4,23 ton brandstof, 4 rijen hoog.',
  }),
  P({
    id: 'tank-xs', kind: 'tank', group: 'tank', name: 'Tiny tank', nameNl: 'Minitank',
    rows: 1, w: 1, fuel: 2.75, dry: 0.16,
    note: '2.75 tonnes of fuel, 1 rows tall.',
    noteNl: '2,75 ton brandstof, 1 rijen hoog.',
  }),
  P({
    id: 'tank-s', kind: 'tank', group: 'tank', name: 'Small tank', nameNl: 'Kleine tank',
    rows: 2, w: 1, fuel: 5.5, dry: 0.27,
    note: '5.5 tonnes of fuel, 2 rows tall.',
    noteNl: '5,5 ton brandstof, 2 rijen hoog.',
  }),
  P({
    id: 'tank-m', kind: 'tank', group: 'tank', name: 'Medium tank', nameNl: 'Middeltank',
    rows: 3, w: 1, fuel: 8.25, dry: 0.38,
    note: '8.25 tonnes of fuel, 3 rows tall.',
    noteNl: '8,25 ton brandstof, 3 rijen hoog.',
  }),
  P({
    id: 'tank-l', kind: 'tank', group: 'tank', name: 'Big tank', nameNl: 'Grote tank',
    rows: 4, w: 1, fuel: 11.0, dry: 0.49,
    note: '11.0 tonnes of fuel, 4 rows tall.',
    noteNl: '11,0 ton brandstof, 4 rijen hoog.',
  }),
  P({
    id: 'tank-xl', kind: 'tank', group: 'tank', name: 'Tall tank', nameNl: 'Lange tank',
    rows: 5, w: 1, fuel: 13.75, dry: 0.6,
    note: '13.75 tonnes of fuel, 5 rows tall.',
    noteNl: '13,75 ton brandstof, 5 rijen hoog.',
  }),
  P({
    id: 'tank-xxl', kind: 'tank', group: 'tank', name: 'Giant tank', nameNl: 'Reuzetank',
    rows: 6, w: 1, fuel: 16.5, dry: 0.71,
    note: '16.5 tonnes of fuel, 6 rows tall.',
    noteNl: '16,5 ton brandstof, 6 rijen hoog.',
  }),
  P({
    id: 'tank-w2', kind: 'tank', group: 'tank', name: 'Wide tank 2', nameNl: 'Brede tank 2',
    rows: 2, w: 1.4, fuel: 10.78, dry: 0.48,
    note: '10.78 tonnes of fuel, 2 rows tall.',
    noteNl: '10,78 ton brandstof, 2 rijen hoog.',
  }),
  P({
    id: 'tank-w', kind: 'tank', group: 'tank', name: 'Wide tank 3', nameNl: 'Brede tank 3',
    rows: 3, w: 1.4, fuel: 16.17, dry: 0.7,
    note: '16.17 tonnes of fuel, 3 rows tall.',
    noteNl: '16,17 ton brandstof, 3 rijen hoog.',
  }),
  P({
    id: 'tank-w4', kind: 'tank', group: 'tank', name: 'Wide tank 4', nameNl: 'Brede tank 4',
    rows: 4, w: 1.4, fuel: 21.56, dry: 0.91,
    note: '21.56 tonnes of fuel, 4 rows tall.',
    noteNl: '21,56 ton brandstof, 4 rijen hoog.',
  }),
  P({
    id: 'tank-w5', kind: 'tank', group: 'tank', name: 'Wide tank 5', nameNl: 'Brede tank 5',
    rows: 5, w: 1.4, fuel: 26.95, dry: 1.13,
    note: '26.95 tonnes of fuel, 5 rows tall.',
    noteNl: '26,95 ton brandstof, 5 rijen hoog.',
  }),
  P({
    id: 'tank-h3', kind: 'tank', group: 'tank', name: 'Huge tank 3', nameNl: 'Kolostank 3',
    rows: 3, w: 1.8, fuel: 26.73, dry: 1.12,
    note: '26.73 tonnes of fuel, 3 rows tall.',
    noteNl: '26,73 ton brandstof, 3 rijen hoog.',
  }),
  P({
    id: 'tank-h4', kind: 'tank', group: 'tank', name: 'Huge tank 4', nameNl: 'Kolostank 4',
    rows: 4, w: 1.8, fuel: 35.64, dry: 1.48,
    note: '35.64 tonnes of fuel, 4 rows tall.',
    noteNl: '35,64 ton brandstof, 4 rijen hoog.',
  }),
  P({
    id: 'tank-h5', kind: 'tank', group: 'tank', name: 'Huge tank 5', nameNl: 'Kolostank 5',
    rows: 5, w: 1.8, fuel: 44.55, dry: 1.83,
    note: '44.55 tonnes of fuel, 5 rows tall.',
    noteNl: '44,55 ton brandstof, 5 rijen hoog.',
  }),
  P({
    id: 'tank-ball', kind: 'tank', group: 'tank', name: 'Round tank', nameNl: 'Bolle tank',
    rows: 2, w: 1.25, fuel: 8.59, dry: 0.28,
    note: 'A sphere holds the most for its skin, so it is the lightest tank there is.',
    noteNl: 'Een bol houdt het meeste vast voor zijn huid, dus het is de lichtste tank die er is.',
    art: 'ball',
  }),
  P({
    id: 'tank-thinwall', kind: 'tank', group: 'tank', name: 'Balloon tank', nameNl: 'Ballontank',
    rows: 4, w: 1, fuel: 11.0, dry: 0.27,
    note: 'Skin as thin as a drink can, and only strong when it is full.',
    noteNl: 'Een wand zo dun as een blikje, en alleen sterk als hij vol is.',
    art: 'balloon',
  }),
  P({
    id: 'tank-heavy', kind: 'tank', group: 'tank', name: 'Pressure tank', nameNl: 'Druktank',
    rows: 3, w: 1, fuel: 10.06, dry: 0.83,
    note: 'Thick walls, packed tight. More fuel and more dead metal.',
    noteNl: 'Dikke wanden, strak gevuld. Meer brandstof en meer dood metaal.',
    art: 'ribbed',
  }),
  P({
    id: 'tank-long', kind: 'tank', group: 'tank', name: 'Needle tank', nameNl: 'Naaldtank',
    rows: 6, w: 0.62, fuel: 6.34, dry: 0.3,
    note: 'Six rows of almost nothing. Slippery and not much use on its own.',
    noteNl: 'Zes rijen van bijna niets. Glad, en in zijn eentje niet veel waard.',
    art: 'tank',
  }),

  // ---- engines: thrust and exhaust speed are given, the burn rate falls out of them
  P({
    id: 'engine-v0', kind: 'engine', group: 'engine', name: 'Vernier', nameNl: 'Stuurmotortje',
    rows: 1, w: 0.5, burn: 0.0106, exhaust: 2450, dry: 0.06,
    note: 'A thimble of thrust for nudging something small.',
    noteNl: 'Een vingerhoed duwkracht om iets kleins te verzetten.',
    art: 'bell',
  }),
  P({
    id: 'engine-xs', kind: 'engine', group: 'engine', name: 'Tiny engine', nameNl: 'Minimotor',
    rows: 1, w: 0.7, burn: 0.0358, exhaust: 2400, dry: 0.2,
    note: 'Barely lifts itself. Useful on top, where there is nothing left to lift.',
    noteNl: 'Tilt zichzelf amper op. Handig bovenin, waar niets meer te tillen valt.',
    art: 'bell',
  }),
  P({
    id: 'engine-s', kind: 'engine', group: 'engine', name: 'Small engine', nameNl: 'Kleine motor',
    rows: 1, w: 1, burn: 0.1019, exhaust: 2600, dry: 0.5,
    note: 'The one to start with. Lifts about forty tonnes and nothing else.',
    noteNl: 'Om mee te beginnen. Tilt ongeveer veertig ton en verder niets.',
    art: 'bell',
  }),
  P({
    id: 'engine-m', kind: 'engine', group: 'engine', name: 'Medium engine', nameNl: 'Middenmotor',
    rows: 1, w: 1.02, burn: 0.2214, exhaust: 2800, dry: 0.85,
    note: 'Twice the small one, and only two thirds heavier.',
    noteNl: 'Twee keer de kleine, en maar twee derde zwaarder.',
    art: 'bell',
  }),
  P({
    id: 'engine-l', kind: 'engine', group: 'engine', name: 'Big engine', nameNl: 'Grote motor',
    rows: 1, w: 1.06, burn: 0.3298, exhaust: 3050, dry: 1.3,
    note: 'Four times the push of the small one, and nearly three times the weight.',
    noteNl: 'Vier keer zoveel duw als de kleine, en bijna drie keer zo zwaar.',
    art: 'bell',
  }),
  P({
    id: 'engine-x', kind: 'engine', group: 'engine', name: 'Three engines', nameNl: 'Drie motoren',
    rows: 2, w: 1.3, burn: 0.9302, exhaust: 2950, dry: 2.8, bulk: 0.9,
    note: 'Brute force off the pad. Drinks the tank in a hurry.',
    noteNl: 'Botte kracht bij het opstijgen. Drinkt de tank snel leeg.',
    art: 'bell', bells: 3,
  }),
  P({
    id: 'engine-w', kind: 'engine', group: 'engine', name: 'Nine engines', nameNl: 'Negen motoren',
    rows: 2, w: 1.45, burn: 2.5799, exhaust: 2980, dry: 7.0, bulk: 0.85,
    note: 'A whole first stage in one piece. It will lift anything you can build.',
    noteNl: 'Een hele eerste trap in een stuk. Tilt alles op wat je kunt bouwen.',
    art: 'bell', bells: 5,
  }),
  P({
    id: 'engine-w2', kind: 'engine', group: 'engine', name: 'Thirty engines', nameNl: 'Dertig motoren',
    rows: 3, w: 1.8, burn: 8.0, exhaust: 3000, dry: 20.0, bulk: 0.8,
    note: 'Absurd, and real: the biggest rocket ever built lights thirty-three at once.',
    noteNl: 'Absurd, en echt: de grootste raket ooit ontsteekt er drieëndertig tegelijk.',
    art: 'bell', bells: 7,
  }),
  P({
    id: 'engine-m2', kind: 'engine', group: 'engine', name: 'Methane engine', nameNl: 'Methaanmotor',
    rows: 2, w: 1.05, burn: 0.2667, exhaust: 3300, dry: 1.15,
    note: 'Burns methane. Cleaner, and the exhaust comes out faster than kerosene.',
    noteNl: 'Verbrandt methaan. Schoner, en de uitlaat gaat er sneller uit dan bij kerosine.',
    art: 'bell',
  }),
  P({
    id: 'engine-m3', kind: 'engine', group: 'engine', name: 'Big methane engine', nameNl: 'Grote methaanmotor',
    rows: 2, w: 1.2, burn: 0.6866, exhaust: 3350, dry: 2.6, bulk: 0.92,
    note: 'A stack of the same idea. Strong and efficient at once.',
    noteNl: 'Een stapel van hetzelfde idee. Sterk en zuinig tegelijk.',
    art: 'bell', bells: 2,
  }),
  P({
    id: 'engine-h', kind: 'engine', group: 'engine', name: 'Hydrogen engine', nameNl: 'Waterstofmotor',
    rows: 2, w: 1.1, burn: 0.252, exhaust: 4400, dry: 1.5,
    note: 'Burns hydrogen, so the exhaust comes out fast. Strong and efficient at once.',
    noteNl: 'Verbrandt waterstof, dus de uitlaat gaat er snel uit. Sterk en zuinig tegelijk.',
    art: 'bell',
  }),
  P({
    id: 'engine-h2', kind: 'engine', group: 'engine', name: 'Big hydrogen engine', nameNl: 'Grote waterstofmotor',
    rows: 2, w: 1.3, burn: 0.5057, exhaust: 4350, dry: 3.1, bulk: 0.9,
    note: 'Two of them in one casing. The workhorse of the big launchers.',
    noteNl: 'Twee in een behuizing. Het werkpaard van de grote draagraketten.',
    art: 'bell', bells: 2,
  }),
  P({
    id: 'engine-a', kind: 'engine', group: 'engine', name: 'Aerospike', nameNl: 'Aerospike',
    rows: 2, w: 1.15, burn: 0.3194, exhaust: 3600, dry: 1.9,
    note: 'No bell at all. Works as well low down as it does high up, which no normal engine does.',
    noteNl: 'Helemaal geen klok. Werkt laag net zo goed als hoog, en dat doet geen gewone motor.',
    art: 'spike',
  }),
  P({
    id: 'engine-a2', kind: 'engine', group: 'engine', name: 'Big aerospike', nameNl: 'Grote aerospike',
    rows: 2, w: 1.4, burn: 0.7123, exhaust: 3650, dry: 4.1, bulk: 0.9,
    note: 'The same trick, larger. Heavy for its push and worth it.',
    noteNl: 'Dezelfde truc, groter. Zwaar voor zijn duw en dat is hij waard.',
    art: 'spike', bells: 2,
  }),
  P({
    id: 'engine-v', kind: 'engine', group: 'engine', name: 'Vacuum engine', nameNl: 'Vacuummotor',
    rows: 2, w: 1, burn: 0.102, exhaust: 4000, dry: 0.5,
    note: 'A big soft bell, made for the emptiness. Quiet, and it goes furthest.',
    noteNl: 'Een grote zachte klok, gemaakt voor de leegte. Stil, en komt het verst.',
    art: 'bell',
  }),
  P({
    id: 'engine-v2', kind: 'engine', group: 'engine', name: 'Big vacuum engine', nameNl: 'Grote vacuummotor',
    rows: 3, w: 1.25, burn: 0.2458, exhaust: 4150, dry: 1.4,
    note: 'The same, with a bell you could sit in.',
    noteNl: 'Dezelfde, met een klok waar je in kunt zitten.',
    art: 'bell',
  }),
  P({
    id: 'engine-n', kind: 'engine', group: 'engine', name: 'Nuclear engine', nameNl: 'Kernmotor',
    rows: 2, w: 1.06, burn: 0.084, exhaust: 8000, dry: 1.2,
    note: 'Heats the fuel with a reactor. Twice the exhaust speed of anything chemical.',
    noteNl: 'Verhit de brandstof met een reactor. Twee keer zo snelle uitlaat als alles chemisch.',
    art: 'reactor',
  }),
  P({
    id: 'engine-n2', kind: 'engine', group: 'engine', name: 'Big nuclear engine', nameNl: 'Grote kernmotor',
    rows: 3, w: 1.25, burn: 0.1829, exhaust: 8200, dry: 2.9,
    note: 'A bigger reactor. Nothing chemical will ever catch it.',
    noteNl: 'Een grotere reactor. Niets chemisch haalt hem ooit in.',
    art: 'reactor',
  }),
  P({
    id: 'engine-t', kind: 'engine', group: 'engine', name: 'Turbo', nameNl: 'Turbo',
    rows: 1, w: 0.9, burn: 0.4091, exhaust: 2200, dry: 0.7,
    note: 'Runs the pumps far past sensible. Enormous push, and it drinks the tank.',
    noteNl: 'Laat de pompen ver voorbij verstandig draaien. Enorme duw, en hij zuipt de tank leeg.',
    art: 'turbo',
  }),
  P({
    id: 'engine-t2', kind: 'engine', group: 'engine', name: 'Big turbo', nameNl: 'Grote turbo',
    rows: 2, w: 1.15, burn: 1.1163, exhaust: 2150, dry: 1.7,
    note: 'The same recklessness, bigger. Wonderful for the first ten seconds.',
    noteNl: 'Dezelfde roekeloosheid, groter. Heerlijk voor de eerste tien seconden.',
    art: 'turbo',
  }),
  P({
    id: 'engine-sep', kind: 'engine', group: 'engine', name: 'Separation motor', nameNl: 'Scheidingsmotor',
    rows: 1, w: 0.42, burn: 0.02, exhaust: 2000, dry: 0.05,
    note: 'A puff to shove a spent stage clear. That is all it is for.',
    noteNl: 'Een pufje om een lege trap weg te duwen. Daar is hij voor.',
    art: 'bell',
  }),
  P({
    id: 'engine-rcs', kind: 'engine', group: 'engine', name: 'Thruster block', nameNl: 'Stuurblok',
    rows: 1, w: 0.55, burn: 0.0179, exhaust: 2900, dry: 0.12,
    note: 'Four small nozzles. Not for going anywhere, for pointing.',
    noteNl: 'Vier kleine tuitjes. Niet om ergens te komen, om te richten.',
    art: 'rcs', bells: 4,
  }),

  // ---- strap-on boosters: fuel and engine in one casing
  P({
    id: 'srb-xs', kind: 'solid', group: 'booster', name: 'Pocket booster', nameNl: 'Zakbooster',
    rows: 1, w: 0.6, fuel: 2.2, burn: 0.0816, exhaust: 2450, dry: 0.16, sharp: 0.7, bulk: 1.0,
    note: 'A stubby can of solid fuel. Lights once and is over quickly.',
    noteNl: 'Een kort blikje vaste brandstof. Gaat een keer aan en is zo voorbij.',
  }),
  P({
    id: 'srb-s', kind: 'solid', group: 'booster', name: 'Single booster', nameNl: 'Enkele booster',
    rows: 2, w: 0.64, fuel: 5, burn: 0.2792, exhaust: 2500, dry: 0.35, sharp: 0.7, bulk: 1.0,
    note: 'Fuel and engine in one. Lights once, burns hard, cannot be turned off.',
    noteNl: 'Brandstof en motor in een. Gaat een keer aan, brandt hard, kan niet uit.',
  }),
  P({
    id: 'srb-d', kind: 'solid', group: 'booster', name: 'Double booster', nameNl: 'Dubbele booster',
    rows: 3, w: 1.34, fuel: 11, burn: 0.5852, exhaust: 2500, dry: 0.75, sharp: 0.7, bulk: 0.5,
    note: 'Two strapped together. Twice the push and twice the air to push through.',
    noteNl: 'Twee aan elkaar. Twee keer zoveel duw en twee keer zoveel lucht om doorheen te duwen.',
    tubes: 2,
  }),
  P({
    id: 'srb-t', kind: 'solid', group: 'booster', name: 'Triple booster', nameNl: 'Drievoudige booster',
    rows: 4, w: 1.96, fuel: 22, burn: 1.1, exhaust: 2500, dry: 1.5, sharp: 0.7, bulk: 0.333,
    note: 'Three in a row. Enormous off the pad, and enormously wide.',
    noteNl: 'Drie op een rij. Enorm bij het opstijgen, en enorm breed.',
    tubes: 3,
  }),
  P({
    id: 'srb-l', kind: 'solid', group: 'booster', name: 'Big booster', nameNl: 'Grote booster',
    rows: 4, w: 0.74, fuel: 12, burn: 0.5851, exhaust: 2550, dry: 0.75, sharp: 0.7, bulk: 1.0,
    note: 'Twelve tonnes of solid fuel. Two of these will shift almost anything.',
    noteNl: 'Twaalf ton vaste brandstof. Twee hiervan krijgen bijna alles in beweging.',
  }),
  P({
    id: 'srb-ld', kind: 'solid', group: 'booster', name: 'Big double', nameNl: 'Grote dubbele',
    rows: 5, w: 1.5, fuel: 26, burn: 1.2157, exhaust: 2550, dry: 1.6, sharp: 0.7, bulk: 0.5,
    note: 'A pair of the big ones. The stack leaves in a hurry.',
    noteNl: 'Een paar van de grote. De stapel vertrekt met haast.',
    tubes: 2,
  }),
  P({
    id: 'srb-lt', kind: 'solid', group: 'booster', name: 'Big triple', nameNl: 'Grote drievoudige',
    rows: 6, w: 2.2, fuel: 40, burn: 1.8431, exhaust: 2550, dry: 2.5, sharp: 0.7, bulk: 0.333,
    note: 'Three big ones. There is nothing subtle about it.',
    noteNl: 'Drie grote. Er is niets subtiels aan.',
    tubes: 3,
  }),
  P({
    id: 'srb-xl', kind: 'solid', group: 'booster', name: 'Monster booster', nameNl: 'Monsterbooster',
    rows: 6, w: 0.95, fuel: 26, burn: 1.1538, exhaust: 2600, dry: 1.6, sharp: 0.7, bulk: 1.0,
    note: 'One casing, six rows tall. The kind that stands beside a shuttle.',
    noteNl: 'Een casing, zes rijen hoog. Het soort dat naast een shuttle staat.',
  }),
  P({
    id: 'lrb-s', kind: 'solid', group: 'booster', name: 'Liquid strap-on', nameNl: 'Vloeibare aanbouw',
    rows: 4, w: 0.8, fuel: 11, burn: 0.2951, exhaust: 3050, dry: 0.9, sharp: 0.7, bulk: 1.0,
    note: 'A little rocket bolted to the side, burning proper fuel. Gentler and it lasts.',
    noteNl: 'Een raketje aan de zijkant, met echte brandstof. Rustiger, en het houdt aan.',
  }),
  P({
    id: 'lrb-l', kind: 'solid', group: 'booster', name: 'Big liquid strap-on', nameNl: 'Grote vloeibare aanbouw',
    rows: 6, w: 1.0, fuel: 22, burn: 0.5484, exhaust: 3100, dry: 1.7, sharp: 0.7, bulk: 1.0,
    note: 'The same, twice over. Half a rocket in its own right.',
    noteNl: 'Dezelfde, twee keer. Op zichzelf al een halve raket.',
  }),
  P({
    id: 'srb-sep', kind: 'solid', group: 'booster', name: 'Kick motor', nameNl: 'Schopmotor',
    rows: 1, w: 0.7, fuel: 1.2, burn: 0.1103, exhaust: 2900, dry: 0.12, sharp: 0.7, bulk: 1.0,
    note: 'A short hard shove for the very top of a rocket.',
    noteNl: 'Een korte harde zet voor het allerbovenste van een raket.',
  }),

  // ---- wings, structure and the things you put on because you want to
  P({
    id: 'fin-xs', kind: 'fin', group: 'extra', name: 'Tail fins', nameNl: 'Staartvinnen',
    rows: 1, w: 1.05, dry: 0.06,
    note: 'Three little blades. Enough for a small rocket.',
    noteNl: 'Drie kleine bladen. Genoeg voor een kleine raket.',
  }),
  P({
    id: 'fin-s', kind: 'fin', group: 'extra', name: 'Small fins', nameNl: 'Kleine vinnen',
    rows: 1, w: 1.35, dry: 0.15,
    note: 'Keeps the nose pointing up in the thick air. Costs a little speed.',
    noteNl: 'Houdt de neus omhoog in de dikke lucht. Kost een beetje snelheid.',
  }),
  P({
    id: 'fin-m', kind: 'fin', group: 'extra', name: 'Swept fins', nameNl: 'Gepijlde vinnen',
    rows: 2, w: 1.5, dry: 0.26,
    note: 'Longer and raked back. Steadier, and the air notices.',
    noteNl: 'Langer en naar achteren gepijld. Rustiger, en de lucht merkt het.',
  }),
  P({
    id: 'fin-l', kind: 'fin', group: 'extra', name: 'Big fins', nameNl: 'Grote vinnen',
    rows: 2, w: 1.7, dry: 0.4,
    note: 'Holds a wobbly rocket dead straight, and the air makes you pay for it.',
    noteNl: 'Houdt een wiebelige raket kaarsrecht, en de lucht laat je ervoor betalen.',
  }),
  P({
    id: 'fin-grid', kind: 'fin', group: 'extra', name: 'Grid fins', nameNl: 'Roostervinnen',
    rows: 1, w: 1.25, dry: 0.32,
    note: 'A waffle of little blades. Enormous grip on the air and enormous drag.',
    noteNl: 'Een wafel van kleine bladen. Enorme grip op de lucht en enorme weerstand.',
    art: 'grid',
  }),
  P({
    id: 'wing-s', kind: 'fin', group: 'extra', name: 'Small wing', nameNl: 'Kleine vleugel',
    rows: 2, w: 1.6, dry: 0.3,
    note: 'A flat plate out to one side. It steadies and it drags.',
    noteNl: 'Een plat vlak opzij. Het stabiliseert en het remt.',
    art: 'wing',
  }),
  P({
    id: 'wing-l', kind: 'fin', group: 'extra', name: 'Big wing', nameNl: 'Grote vleugel',
    rows: 3, w: 2.0, dry: 0.7,
    note: 'A proper wing. Wonderful on a plane, questionable on a rocket.',
    noteNl: 'Een echte vleugel. Prachtig op een vliegtuig, twijfelachtig op een raket.',
    art: 'wing',
  }),
  P({
    id: 'airbrake', kind: 'fin', group: 'extra', name: 'Air brake', nameNl: 'Remklep',
    rows: 1, w: 1.15, dry: 0.2,
    note: 'A flap that stands out into the airflow on purpose.',
    noteNl: 'Een klep die expres in de luchtstroom gaat staan.',
    art: 'brake',
  }),
  P({
    id: 'adapter', kind: 'truss', group: 'extra', name: 'Taper', nameNl: 'Verloopstuk',
    rows: 1, w: 1.1, dry: 0.12,
    note: 'Takes the width of whatever is under it and narrows to whatever is on top.',
    noteNl: 'Neemt de breedte van wat eronder staat en loopt af naar wat erop staat.',
    art: 'taper',
  }),
  P({
    id: 'adapter-l', kind: 'truss', group: 'extra', name: 'Tall taper', nameNl: 'Lang verloopstuk',
    rows: 2, w: 1.2, dry: 0.2,
    note: 'The same, over two rows, so the change is gentler.',
    noteNl: 'Hetzelfde, over twee rijen, zodat de overgang zachter is.',
    art: 'taper',
  }),
  P({
    id: 'truss', kind: 'truss', group: 'extra', name: 'Girder', nameNl: 'Vakwerk',
    rows: 2, w: 0.42, dry: 0.08,
    note: 'Open framework. Weighs next to nothing and holds things apart.',
    noteNl: 'Open frame. Weegt bijna niets en houdt dingen uit elkaar.',
    art: 'truss',
  }),
  P({
    id: 'truss-l', kind: 'truss', group: 'extra', name: 'Long girder', nameNl: 'Lang vakwerk',
    rows: 4, w: 0.42, dry: 0.14,
    note: 'Four rows of almost nothing at all.',
    noteNl: 'Vier rijen van bijna helemaal niets.',
    art: 'truss',
  }),
  P({
    id: 'strut', kind: 'truss', group: 'extra', name: 'Strut', nameNl: 'Steun',
    rows: 1, w: 0.4, dry: 0.04,
    note: 'A short brace. Mostly it is there to make a joint look solid.',
    noteNl: 'Een korte schoor. Vooral om een verbinding stevig te laten lijken.',
    art: 'strut',
  }),
  P({
    id: 'decoupler', kind: 'truss', group: 'extra', name: 'Decoupler', nameNl: 'Ontkoppelaar',
    rows: 1, w: 1.05, dry: 0.1,
    note: 'A ring of little charges. Press the button and whatever is under it goes.',
    noteNl: 'Een ring met kleine ladingen. Druk op de knop en wat eronder zit gaat weg.',
    art: 'ring',
  }),
  P({
    id: 'decoupler-l', kind: 'truss', group: 'extra', name: 'Wide decoupler', nameNl: 'Brede ontkoppelaar',
    rows: 1, w: 1.45, dry: 0.18,
    note: 'The same ring, for a wide stack.',
    noteNl: 'Dezelfde ring, voor een brede stapel.',
    art: 'ring',
  }),
  P({
    id: 'leg', kind: 'truss', group: 'extra', name: 'Landing leg', nameNl: 'Landingspoot',
    rows: 1, w: 1.3, dry: 0.22, bulk: 0.55,
    note: 'A foot to stand on somewhere else. Up here it is mass.',
    noteNl: 'Een voet om ergens anders op te staan. Hierboven is het massa.',
    art: 'leg',
  }),
  P({
    id: 'leg-l', kind: 'truss', group: 'extra', name: 'Big landing leg', nameNl: 'Grote landingspoot',
    rows: 2, w: 1.6, dry: 0.45, bulk: 0.55,
    note: 'A bigger foot for a heavier thing.',
    noteNl: 'Een grotere voet voor iets zwaarders.',
    art: 'leg',
  }),
  P({
    id: 'chute', kind: 'truss', group: 'extra', name: 'Parachute', nameNl: 'Parachute',
    rows: 1, w: 0.9, dry: 0.12,
    note: 'Folded silk. It weighs almost nothing and it is a promise.',
    noteNl: 'Opgevouwen zijde. Weegt bijna niets en is een belofte.',
    art: 'chute',
  }),
  P({
    id: 'chute-l', kind: 'truss', group: 'extra', name: 'Big parachute', nameNl: 'Grote parachute',
    rows: 1, w: 1.15, dry: 0.28,
    note: 'Enough canopy for a capsule.',
    noteNl: 'Genoeg doek voor een capsule.',
    art: 'chute',
  }),
  P({
    id: 'solar', kind: 'truss', group: 'extra', name: 'Solar panel', nameNl: 'Zonnepaneel',
    rows: 1, w: 1.5, dry: 0.16, bulk: 0.4,
    note: 'Wings of glass that fold out up there. Flat, wide and no help at all on the way up.',
    noteNl: 'Glazen vleugels die daarboven uitklappen. Plat, breed, en onderweg omhoog geen enkele hulp.',
    art: 'solar',
  }),
  P({
    id: 'solar-l', kind: 'truss', group: 'extra', name: 'Big solar array', nameNl: 'Groot zonnepaneel',
    rows: 2, w: 1.9, dry: 0.34, bulk: 0.4,
    note: 'Two long wings. Beautiful, and pure cargo.',
    noteNl: 'Twee lange vleugels. Prachtig, en pure vracht.',
    art: 'solar',
  }),
  P({
    id: 'antenna', kind: 'truss', group: 'extra', name: 'Antenna', nameNl: 'Antenne',
    rows: 1, w: 0.85, dry: 0.08, bulk: 0.5,
    note: 'A dish for talking home.',
    noteNl: 'Een schotel om naar huis te praten.',
    art: 'dish',
  }),
  P({
    id: 'light', kind: 'truss', group: 'extra', name: 'Lamp', nameNl: 'Lamp',
    rows: 1, w: 0.55, dry: 0.03,
    note: 'A light on the side. It changes nothing and it looks right.',
    noteNl: 'Een lamp aan de zijkant. Verandert niets en het staat goed.',
    art: 'lamp',
  }),
  P({
    id: 'camera', kind: 'truss', group: 'extra', name: 'Camera', nameNl: 'Camera',
    rows: 1, w: 0.5, dry: 0.04,
    note: 'Points back at the rocket. Somebody has to film it.',
    noteNl: 'Kijkt naar de raket. Iemand moet het filmen.',
    art: 'camera',
  }),
  P({
    id: 'ladder', kind: 'truss', group: 'extra', name: 'Ladder', nameNl: 'Ladder',
    rows: 2, w: 0.45, dry: 0.05,
    note: 'Rungs up the side. For getting in, and for getting out again.',
    noteNl: 'Sporten langs de zijkant. Om in te stappen, en om er weer uit te komen.',
    art: 'ladder',
  }),
  P({
    id: 'flag', kind: 'truss', group: 'extra', name: 'Flag', nameNl: 'Vlag',
    rows: 1, w: 0.6, dry: 0.02,
    note: 'Nobody needs it. Everybody puts one on.',
    noteNl: 'Niemand heeft hem nodig. Iedereen zet er een op.',
    art: 'flag',
  }),
];


export const partById = (id: string): Part => PARTS.find(p => p.id === id) ?? PARTS[0];

export const GROUPS: Array<{ id: Group; name: string; nameNl: string }> = [
  { id: 'top', name: 'Top', nameNl: 'Punt' },
  { id: 'tank', name: 'Tanks', nameNl: 'Tanks' },
  { id: 'engine', name: 'Engines', nameNl: 'Motoren' },
  { id: 'booster', name: 'Boosters', nameNl: 'Boosters' },
  { id: 'extra', name: 'Extras', nameNl: 'Rest' },
];

export const partsIn = (g: Group): Part[] => PARTS.filter(p => p.group === g);

// ---------------------------------------------------------------- what you built

/** One part, standing in a column with its foot on a row. */
export interface Placed {
  id: string;
  col: number;
  /** the row its foot stands on; it fills upward from there */
  row: number;
  /**
   * Seconds after lift-off before this engine lights, set in the workshop.
   *
   * Real rockets do this all the time: the strap-on boosters of an Ariane light with the core, a
   * second set lights a minute later, and an upper stage waits until the first one has finished.
   * Here it is the difference between all your thrust in the first ten seconds and a rocket that
   * keeps pushing.
   */
  delay?: number;
}

export type Design = Placed[];

export const topRow = (p: Placed): number => p.row + partById(p.id).rows - 1;

/** Do these two occupy any of the same cells? */
export function clash(a: Placed, b: Placed): boolean {
  if (a.col !== b.col) return false;
  return a.row <= topRow(b) && b.row <= topRow(a);
}

/** Are they close enough to be bolted together - stacked, or side by side? */
export function touches(a: Placed, b: Placed): boolean {
  const d = Math.abs(a.col - b.col);
  if (d === 0) return topRow(a) + 1 === b.row || topRow(b) + 1 === a.row;
  if (d === 1) return a.row <= topRow(b) && b.row <= topRow(a);
  return false;
}

export const inGrid = (p: Placed): boolean =>
  p.col >= 0 && p.col < COLS && p.row >= 0 && topRow(p) < ROWS;

/**
 * May this part go here?
 *
 * Inside the grid, not on top of something else, and touching the rest of the rocket - because a
 * piece floating half a metre from the rest of it is not a rocket, it is two rockets. The very
 * first part may go anywhere.
 */
export function canPlace(design: Design, p: Placed, skip = -1): boolean {
  if (!inGrid(p)) return false;
  let any = false;
  for (let i = 0; i < design.length; i++) {
    if (i === skip) continue;
    any = true;
    if (clash(p, design[i])) return false;
  }
  if (!any) return true;
  return design.some((q, i) => i !== skip && touches(p, q));
}

/** Is the whole thing one piece? Dragging a part out from the middle can split it in two. */
export function isOnePiece(design: Design): boolean {
  if (design.length < 2) return true;
  const seen = new Set<number>([0]);
  const queue = [0];
  while (queue.length) {
    const i = queue.pop()!;
    design.forEach((q, j) => {
      if (seen.has(j) || !touches(design[i], q)) return;
      seen.add(j);
      queue.push(j);
    });
  }
  return seen.size === design.length;
}

/**
 * How wide a part really is once it is bolted on.
 *
 * A nose cone takes the width of whatever it is capping, which is the only sensible thing for it
 * to do: a cone on a slim booster is a slim cone, and a cone that stayed a full column wide would
 * make the booster it is meant to help *worse*. Everything else is the width it says it is.
 */
export function widthOf(design: Design, i: number): number {
  const p = design[i];
  const part = partById(p.id);
  if (part.id === 'nose') return neighbourWidth(design, i, -1) ?? part.w;
  if (part.id === 'adapter') {
    // the air feels the average of the two ends of a taper
    const span = taperSpan(design, i);
    return (span.bottom + span.top) / 2;
  }
  return part.w;
}

/** The width of the part directly below (`-1`) or directly above (`+1`) this one, if there is one. */
function neighbourWidth(design: Design, i: number, dir: -1 | 1): number | null {
  const p = design[i];
  let found: number | null = null;
  let best = -1;
  design.forEach((q, k) => {
    if (k === i || q.col !== p.col) return;
    const meets = dir === -1 ? topRow(q) + 1 === p.row : q.row === topRow(p) + 1;
    if (!meets || q.row <= best) return;
    best = q.row;
    found = partById(q.id).id === 'adapter' ? null : partById(q.id).w;
  });
  return found;
}

/**
 * How wide a taper is at its foot and at its shoulder.
 *
 * This is the piece that lets a rocket actually narrow towards the top instead of stepping down
 * in ledges: it takes the width of whatever it is standing on and runs up to the width of
 * whatever is standing on it. Put one between a wide tank and a narrow one and the join
 * disappears.
 */
export function taperSpan(design: Design, i: number): { bottom: number; top: number } {
  const own = partById(design[i].id).w;
  const bottom = neighbourWidth(design, i, -1) ?? own;
  const top = neighbourWidth(design, i, 1) ?? Math.min(own, bottom);
  return { bottom, top };
}

/**
 * Where a fin's root sits, in column space.
 *
 * A fin is bolted to the side of something, so it is drawn flush against whatever is inboard of
 * it rather than floating in the middle of its own column. Without this a fin beside a slim
 * booster hangs in the air with a visible gap, which is the one thing that gives away that the
 * rocket is really a grid.
 */
export function finAnchor(design: Design, i: number, centre: number): number {
  const p = design[i];
  const s = Math.sign(p.col - centre) || 1;
  let edge: number | null = null;
  design.forEach((q, k) => {
    if (k === i || q.col !== p.col - s || !touches(p, q)) return;
    const e = q.col + 0.5 + s * (widthOf(design, k) / 2);
    if (edge === null || s * e > s * edge) edge = e;
  });
  return edge ?? p.col + 0.5;
}

/**
 * Which parts are standing on the ground, directly or through something that is.
 *
 * Anything else is hanging in the air, which happens the moment you pull a tank out of the middle
 * of a stack. Gravity deals with it - see collapse().
 */
function grounded(design: Design): Set<number> {
  const seen = new Set<number>();
  const queue: number[] = [];
  design.forEach((p, i) => { if (p.row === 0) { seen.add(i); queue.push(i); } });
  while (queue.length) {
    const i = queue.pop()!;
    design.forEach((q, j) => {
      if (seen.has(j) || !touches(design[i], q)) return;
      seen.add(j);
      queue.push(j);
    });
  }
  return seen;
}

/**
 * Let whatever is hanging in the air fall until it lands on something.
 *
 * Pull a tank out from under a capsule and the capsule should drop onto the engine, not hover
 * where the tank used to be. One row at a time, so a piece settles on the first thing it meets.
 */
export function collapse(design: Design): void {
  for (let guard = 0; guard < ROWS * 2; guard++) {
    const up = grounded(design);
    let moved = false;
    design.forEach((p, i) => {
      if (up.has(i) || p.row <= 0) return;
      const down: Placed = { id: p.id, col: p.col, row: p.row - 1 };
      if (design.some((q, k) => k !== i && clash(down, q))) return;
      p.row -= 1;
      moved = true;
    });
    if (!moved) return;
  }
}

// ---------------------------------------------------------------- stages

export interface Stage {
  col: number;
  /** seconds after lift-off before this stage's engine lights */
  delay: number;
  /** index in the design of the engine that drives it */
  engine: number;
  /** everything that falls away when it is spent */
  parts: number[];
  /** kilonewtons */
  thrust: number;
  /** tonnes per second */
  burn: number;
  /** tonnes */
  fuel: number;
}

/**
 * Cut the rocket into stages, one list per column.
 *
 * Reading up a column: an engine owns the tanks stacked on top of it until the next engine, and
 * takes the fins and collars around it with it when it goes. That is how a child stacks the parts
 * without being told anything, and it happens to be how a real rocket comes apart.
 *
 * Two things deliberately never fall away. A capsule, probe or cabin is what you are sending, so
 * it stays. And anything sitting in a column with no engine under it at all is dead weight for the
 * whole flight - which is a mistake worth being able to make, and worth being told about.
 */
export function stagesByColumn(design: Design): Map<number, Stage[]> {
  const out = new Map<number, Stage[]>();
  const byCol = new Map<number, number[]>();
  design.forEach((p, i) => {
    const list = byCol.get(p.col) ?? [];
    list.push(i);
    byCol.set(p.col, list);
  });
  for (const [col, idx] of byCol) {
    idx.sort((a, b) => design[a].row - design[b].row);
    const stages: Stage[] = [];
    let cur: Stage | null = null;
    const orphans: number[] = [];
    for (const i of idx) {
      const p = partById(design[i].id);
      if (p.kind === 'pod') continue;                    // payload never drops
      if (p.kind === 'engine' || p.kind === 'solid') {
        cur = { col, delay: Math.max(0, design[i].delay ?? 0), engine: i, parts: [i], thrust: p.burn * p.exhaust, burn: p.burn, fuel: p.fuel };
        stages.push(cur);
        continue;
      }
      if (!cur) { orphans.push(i); continue; }           // below the first engine, or no engine yet
      cur.parts.push(i);
      if (p.kind === 'tank') cur.fuel += p.fuel;
    }
    // whatever sat under the first engine rides with it: fins and collars belong to the bottom
    if (stages.length) stages[0].parts.push(...orphans);

    // An engine with no tank above it can never fire, so it is not a stage - it is structure. Its
    // parts ride with the next stage that can fire, and if there is none they are dead weight.
    // Folding them in here means the flight never has to reason about a stage that cannot light.
    const live: Stage[] = [];
    let carry: number[] = [];
    for (const st of stages) {
      if (st.fuel > 0) { st.parts.push(...carry); carry = []; live.push(st); }
      else carry = carry.concat(st.parts);
    }
    if (carry.length && live.length) live[live.length - 1].parts.push(...carry);
    out.set(col, live);
  }

  // Fins are the one part meant to live in a column of their own, bolted to the outside of the
  // bottom of the rocket. They belong to whatever stage they are strapped to, so they fall away
  // with it - and, more to the point, they are not the mistake that "no engine under it" means.
  const owned = new Set<number>();
  for (const list of out.values()) for (const s of list) for (const i of s.parts) owned.add(i);
  design.forEach((p, i) => {
    if (owned.has(i) || partById(p.id).kind !== 'fin') return;
    let best: Stage | null = null;
    for (const [col, list] of out) {
      if (!list.length || Math.abs(col - p.col) !== 1) continue;
      if (!list[0].parts.some(k => touches(p, design[k]))) continue;
      if (!best || list[0].col === p.col) best = list[0];
    }
    if (best) best.parts.push(i);
  });
  return out;
}

/**
 * Engines that can never light, because there is no tank above them before the next engine.
 *
 * Stacking two engines straight onto each other is the classic first mistake, and it is invisible
 * unless somebody says so: the lower one just sits there being heavy. A solid booster is never on
 * this list, because it carries its own fuel inside it.
 */
export function dudEngines(design: Design): number[] {
  const out: number[] = [];
  const byCol = new Map<number, number[]>();
  design.forEach((p, i) => {
    const list = byCol.get(p.col) ?? [];
    list.push(i);
    byCol.set(p.col, list);
  });
  for (const idx of byCol.values()) {
    idx.sort((a, b) => design[a].row - design[b].row);
    let engine = -1, fuel = 0;
    for (const i of idx) {
      const p = partById(design[i].id);
      if (p.kind === 'engine') {
        if (engine >= 0 && fuel <= 0) out.push(engine);
        engine = i;
        fuel = 0;
        continue;
      }
      if (p.kind === 'solid') { if (engine >= 0 && fuel <= 0) out.push(engine); engine = -1; continue; }
      if (p.kind === 'tank' && engine >= 0) fuel += p.fuel;
    }
    if (engine >= 0 && fuel <= 0) out.push(engine);
  }
  return out;
}

/**
 * What is still bolted to the payload, given what has already fallen away.
 *
 * A rocket is only a rocket while it is in one piece. Drop the core stage out from between a pair
 * of boosters that are still burning and the two halves are no longer connected to what you are
 * sending - so they are not part of the rocket any more either, and they go too. Without this the
 * pieces simply hang there in formation, which is the one thing that makes the whole illusion
 * collapse.
 */
export function stillAttached(design: Design, dropped: ReadonlySet<number>): Set<number> {
  const keep = new Set<number>();
  const queue: number[] = [];
  design.forEach((p, i) => {
    if (dropped.has(i) || partById(p.id).kind !== 'pod') return;
    keep.add(i);
    queue.push(i);
  });
  // nothing is riding: whatever is left around the lowest live part counts as the rocket
  if (!queue.length) {
    let low = -1, lowRow = Infinity;
    design.forEach((p, i) => {
      if (dropped.has(i) || p.row >= lowRow) return;
      lowRow = p.row;
      low = i;
    });
    if (low < 0) return keep;
    keep.add(low);
    queue.push(low);
  }
  while (queue.length) {
    const i = queue.pop()!;
    design.forEach((q, j) => {
      if (keep.has(j) || dropped.has(j) || !touches(design[i], q)) return;
      keep.add(j);
      queue.push(j);
    });
  }
  return keep;
}

/** Parts that will never fall away and never burn: a tank with no engine under it, say. */
export function deadWeight(design: Design): number[] {
  const staged = new Set<number>();
  for (const list of stagesByColumn(design).values()) for (const s of list) for (const i of s.parts) staged.add(i);
  const out: number[] = [];
  design.forEach((p, i) => {
    if (staged.has(i)) return;
    if (partById(p.id).kind === 'pod') return;
    out.push(i);
  });
  return out;
}

/** Everything on the pad, fuel and all, in tonnes. */
export const totalMass = (design: Design): number =>
  design.reduce((m, p) => m + partById(p.id).dry + partById(p.id).fuel, 0);

/** What fires at lift-off: the bottom stage of every column that has one. */
export function padThrust(design: Design): number {
  let n = 0;
  for (const list of stagesByColumn(design).values()) {
    if (list.length && list[0].fuel > 0 && list[0].delay <= 0) n += list[0].thrust;
  }
  return n;
}

/** Everything that will ever fire, whether it lights now or in a minute. */
export function totalThrust(design: Design): number {
  let n = 0;
  for (const list of stagesByColumn(design).values()) for (const s of list) if (s.fuel > 0) n += s.thrust;
  return n;
}

export const G0 = 9.81;
export const padWeight = (design: Design): number => totalMass(design) * G0;
export const canLift = (design: Design): boolean => padThrust(design) > padWeight(design) * 1.02;

/** The delays a child can pick, in seconds. Enough choice to matter, few enough to tap. */
export const DELAYS = [0, 3, 6, 10, 15, 25, 40];
export const clampDelay = (d: number): number =>
  DELAYS.reduce((best, x) => (Math.abs(x - d) < Math.abs(best - d) ? x : best), 0);

/** A rocket needs something to burn, something to burn it with, and something to send. */
export function isFlyable(design: Design): boolean {
  if (!design.length) return false;
  if (!design.some(p => partById(p.id).kind === 'pod')) return false;
  return canLift(design);
}

// ---------------------------------------------------------------- balance

/** Where the weight sits, side to side, in columns. */
export function massCentre(design: Design, dropped?: ReadonlySet<number>): number {
  let m = 0, x = 0;
  design.forEach((p, i) => {
    if (dropped?.has(i)) return;
    const part = partById(p.id);
    const w = part.dry + part.fuel;
    m += w;
    x += w * p.col;
  });
  return m > 0 ? x / m : CENTRE;
}

/** Where the push comes from, side to side, in columns. */
export function pushCentre(design: Design, dropped?: ReadonlySet<number>): number {
  let f = 0, x = 0;
  for (const list of stagesByColumn(design).values()) {
    const s = list.find(q => !dropped?.has(q.engine));
    if (!s || s.fuel <= 0) continue;
    f += s.thrust;
    x += s.thrust * s.col;
  }
  return f > 0 ? x / f : massCentre(design, dropped);
}

/**
 * How lopsided it is, in columns.
 *
 * If the push does not come from under the weight, the rocket turns. A real one gimbals its engines
 * to trim that out; ours just drifts, gently, and the child steers against it - which is exactly
 * what the drift is there to teach.
 */
export const lopsided = (design: Design, dropped?: ReadonlySet<number>): number =>
  pushCentre(design, dropped) - massCentre(design, dropped);

// ---------------------------------------------------------------- the air

const circle = (widthUnits: number): number => Math.PI / 4 * Math.pow(widthUnits * UNIT_M, 2);

/**
 * How much of a column beside the widest one the air actually feels: less than all of it, because
 * it tucks in behind the core, but far from none.
 */
const SIDE_EXPOSURE = 0.6;

export interface Shape {
  width: number;
  height: number;
  fineness: number;
  area: number;
  cd: number;
  drag: number;
  /** how well capped the columns are, 0 for flat lids and 1 for perfect cones */
  sharp: number;
  cols: number;
  fins: number;
}

/**
 * What the air sees, worked out from the shape on the screen.
 *
 * Three things, all of them visible in the drawing. How wide it is across, because a wide rocket
 * has to shove more air aside. How long it is for that width, because a short fat one leaves a hole
 * behind it that the air falls into, and that hole is most of the drag. And what is on top of each
 * column, because a flat lid catches the air and a cone lets it slide - which is what nose cones
 * are, and why they cost a hundred kilos and are worth it.
 */
export function shapeOf(design: Design, dropped?: ReadonlySet<number>): Shape {
  const live = design.filter((_, i) => !dropped?.has(i));
  if (!live.length) {
    return { width: 1, height: 1, fineness: 1, area: circle(1), cd: 1, drag: circle(1), sharp: 0, cols: 0, fins: 0 };
  }
  let left = Infinity, right = -Infinity, bottom = Infinity, top = -Infinity, fins = 0;
  const colArea = new Map<number, number>();
  const colWidth = new Map<number, number>();
  const colTop = new Map<number, { row: number; sharp: number }>();
  design.forEach((p, i) => {
    if (dropped?.has(i)) return;
    const part = partById(p.id);
    const w = widthOf(design, i);
    bottom = Math.min(bottom, p.row);
    top = Math.max(top, topRow(p) + 1);
    // a fin is a blade, not a wall: it costs drag but it is not part of the hole the rocket
    // punches through the air, so it stays out of the width
    if (part.kind === 'fin') { fins++; return; }
    left = Math.min(left, p.col + 0.5 - w / 2);
    right = Math.max(right, p.col + 0.5 + w / 2);
    colArea.set(p.col, Math.max(colArea.get(p.col) ?? 0, circle(w) * part.bulk));
    colWidth.set(p.col, Math.max(colWidth.get(p.col) ?? 0, w));
    const best = colTop.get(p.col);
    if (!best || topRow(p) > best.row) colTop.set(p.col, { row: topRow(p), sharp: part.sharp });
  });
  const width = Math.max(0.5, right - left);
  const height = Math.max(1, top - bottom);
  const fineness = height / width;

  // the column that meets the most air is the core; everything else is partly in its lee
  const biggest = Math.max(...colArea.values(), circle(0.5));
  let area = 0, sharpSum = 0;
  for (const [col, a0] of colArea) {
    const a = a0 * (a0 === biggest ? 1 : SIDE_EXPOSURE);
    area += a;
    sharpSum += a * (colTop.get(col)?.sharp ?? 0);
  }
  if (area <= 0) area = biggest;
  const sharp = sharpSum / area;

  // a flat lid costs a third more than a clean cone, which is about what it really costs
  const cd = (0.9 * Math.exp(-fineness / 4) + 0.22) * (1.32 - 0.5 * sharp) + fins * 0.04;
  return { width, height, fineness, area, cd, drag: cd * area, sharp, cols: colWidth.size, fins };
}

/** Air thickness as a fraction of sea level, gone by about a hundred kilometres. */
export const airAt = (altM: number): number => Math.exp(-Math.max(0, altM) / 8500);
export const densityAt = (altM: number): number => 1.225 * airAt(altM);

export const EARTH_R = 6371e3;
export const gravityAt = (altM: number): number =>
  G0 * Math.pow(EARTH_R / (EARTH_R + Math.max(0, altM)), 2);

/** Nought for a brick, one for a needle. */
export const slipperiness = (s: Shape): number =>
  Math.max(0, Math.min(1, (4.2 - s.drag) / 3.2));

/** The one sentence that says what is costing the most, so there is something to do about it. */
export function shapeHint(s: Shape, nl: boolean): string {
  if (s.sharp < 0.35) {
    return nl ? 'Vlakke bovenkant vangt lucht. Zet er neuskegels op.'
      : 'Flat tops catch the air. Put nose cones on them.';
  }
  if (s.cols >= 4 && s.fineness < 7) {
    return nl ? 'Breed en laag. De lucht moet er ver omheen.'
      : 'Wide and low. The air has a long way round it.';
  }
  if (s.fineness < 4.5) {
    return nl ? 'Kort en dik duwt veel lucht weg. Maak hem langer.'
      : 'Short and fat shoves a lot of air. Make it longer.';
  }
  if (s.fins > 0 && slipperiness(s) < 0.85) {
    return nl ? 'Vinnen houden hem recht, maar kosten snelheid.'
      : 'Fins keep it straight, but they cost speed.';
  }
  if (slipperiness(s) > 0.9) {
    return nl ? 'Lang en dun. Daar glijdt de lucht langs.' : 'Long and thin. The air slides right past.';
  }
  return nl ? 'Redelijk glad. Langer en smaller is beter.' : 'Reasonably sleek. Longer and narrower is better.';
}

/** What is wrong with it, if anything is, in one line. Checked in the order a builder would. */
export function buildProblem(design: Design, nl: boolean): string | null {
  if (!design.length) return null;
  if (!isOnePiece(design)) {
    return nl ? 'Er hangt een stuk los.' : 'A piece is floating loose.';
  }
  if (!design.some(p => partById(p.id).kind === 'pod')) {
    return nl ? 'Er moet iets mee: zet er een capsule of sonde op.'
      : 'Nothing is riding along. Put a capsule or a probe on it.';
  }
  if (padThrust(design) <= 0) {
    return totalThrust(design) > 0
      ? (nl ? 'Alle motoren staan op wachten. Er moet er een op 0 seconden.'
        : 'Every engine is set to wait. One of them has to light at zero.')
      : (nl ? 'Geen motor die kan branden. Zet een motor onder een tank.'
        : 'No engine can fire. Put an engine under a tank.');
  }
  if (!canLift(design)) {
    return nl ? 'Te zwaar om op te tillen.' : 'Too heavy to lift.';
  }
  const duds = dudEngines(design);
  if (duds.length) {
    return nl ? `${duds.length === 1 ? 'Een motor heeft' : `${duds.length} motoren hebben`} geen tank erboven en gaat nooit aan.`
      : `${duds.length === 1 ? 'An engine has' : `${duds.length} engines have`} no tank above, so ${duds.length === 1 ? 'it' : 'they'} will never light.`;
  }
  const dead = deadWeight(design);
  if (dead.length) {
    return nl ? `${dead.length} ${dead.length === 1 ? 'onderdeel heeft' : 'onderdelen hebben'} geen motor eronder: dood gewicht.`
      : `${dead.length} part${dead.length === 1 ? ' has' : 's have'} no engine under them: dead weight.`;
  }
  if (Math.abs(lopsided(design)) > 0.35) {
    return nl ? 'Scheef: de duw komt niet onder het gewicht vandaan.'
      : 'Lopsided: the push is not coming from under the weight.';
  }
  return null;
}

// ---------------------------------------------------------------- the ladder

export interface Milestone {
  /** how fast you must be going when the fuel runs out, in metres per second */
  speed: number;
  /** how far away it is, in kilometres */
  km: number;
  name: string;
  nameNl: string;
  /** stars this is worth */
  stars: number;
  /** the body whose photograph stands for this place, where a camera has been there */
  photo?: string;
  /** which folder that photograph lives in */
  photoIn?: 'planets' | 'moons';
  /** one true thing about it */
  fact?: string;
  factNl?: string;
}

/**
 * Where a rocket can get to, and how fast it has to be going when the fuel runs out to get there.
 *
 * The low rungs are heights, worked out from the speed by the same sum the game runs. The high
 * ones are real places at their real distances, and their speeds are real too: everything past the
 * Moon costs escape velocity - 11.19 km/s - with the speed you want to be left with once you are
 * clear of the Earth added in quadrature on top. Which is why Venus and Mars sit a hundred metres
 * a second apart: once you are off the Earth at all, the inner planets cost about the same, and
 * the expensive ones are the ones further out. That is not a game balance decision, it is the
 * solar system.
 *
 * Nothing here is locked or handed out. It is a set of names for how far you got, and a
 * photograph of the place when the place is somewhere a camera has been.
 */
export const LADDER: Milestone[] = [
  { speed: 0, km: 0, name: 'The pad', nameNl: 'Het platform', stars: 0 },
  { speed: 140, km: 1, name: 'Up with the birds', nameNl: 'Bij de vogels', stars: 1 },
  { speed: 340, km: 6, name: 'Through the clouds', nameNl: 'Door de wolken', stars: 1 },
  { speed: 620, km: 20, name: 'Above the aeroplanes', nameNl: 'Boven de vliegtuigen', stars: 1 },
  {
    speed: 1390, km: 100, name: 'The edge of the air', nameNl: 'De rand van de lucht', stars: 2,
    fact: 'A hundred kilometres up. Above this line there is no sky left to fly in.',
    factNl: 'Honderd kilometer hoog. Hierboven is er geen lucht meer om in te vliegen.',
  },
  {
    speed: 2720, km: 400, name: 'Round the Earth', nameNl: 'Een rondje om de Aarde', stars: 2,
    photo: 'earth',
    fact: 'The height the space station flies at. It goes round the whole Earth in 90 minutes.',
    factNl: 'De hoogte waarop het ruimtestation vliegt. Het gaat in 90 minuten om de hele Aarde.',
  },
  {
    speed: 6800, km: 8000, name: 'Past the satellites', nameNl: 'Voorbij de satellieten', stars: 3,
    photo: 'earth',
    fact: 'Higher than almost everything people have put up there.',
    factNl: 'Hoger dan bijna alles wat mensen daarboven hebben gezet.',
  },
  {
    speed: 11090, km: 384400, name: 'The Moon', nameNl: 'De Maan', stars: 3,
    photo: 'moon', photoIn: 'moons',
    fact: 'A hundred metres a second short of never coming back. Twelve people have stood on it.',
    factNl: 'Honderd meter per seconde onder nooit-meer-terug. Twaalf mensen hebben erop gestaan.',
  },
  {
    speed: 11190, km: 1.5e6, name: 'Away from the Earth', nameNl: 'Los van de Aarde', stars: 4,
    fact: 'Escape velocity: 11.19 km/s. Go this fast and the Earth never pulls you back.',
    factNl: 'Ontsnappingssnelheid: 11,19 km/s. Zo snel, en de Aarde trekt je nooit meer terug.',
  },
  {
    speed: 11470, km: 41e6, name: 'Venus', nameNl: 'Venus', stars: 4,
    photo: 'venus',
    fact: 'The hottest planet: 464 degrees, hot enough to melt lead, under clouds of acid.',
    factNl: 'De heetste planeet: 464 graden, heet genoeg om lood te smelten, onder zuurwolken.',
  },
  {
    speed: 11570, km: 78e6, name: 'Mars', nameNl: 'Mars', stars: 4,
    photo: 'mars',
    fact: 'Rusty, cold and half our size, with the biggest volcano in the solar system.',
    factNl: 'Roestig, koud en half zo groot als wij, met de grootste vulkaan van het zonnestelsel.',
  },
  {
    speed: 14200, km: 630e6, name: 'Jupiter', nameNl: 'Jupiter', stars: 5,
    photo: 'jupiter',
    fact: 'You could pour all the other planets into it and still have room. Its storm is older than your grandparents.',
    factNl: 'Alle andere planeten passen erin en er blijft ruimte over. Zijn storm is ouder dan je opa en oma.',
  },
  {
    speed: 15300, km: 1.3e9, name: 'Saturn', nameNl: 'Saturnus', stars: 5,
    photo: 'saturn',
    fact: 'The rings are billions of lumps of ice, and most of them are no thicker than a house.',
    factNl: 'De ringen zijn miljarden brokken ijs, en de meeste zijn niet dikker dan een huis.',
  },
  {
    speed: 15900, km: 2.7e9, name: 'Uranus', nameNl: 'Uranus', stars: 5,
    photo: 'uranus',
    fact: 'It lies on its side, so each pole gets 42 years of daylight and then 42 years of night.',
    factNl: 'Hij ligt op zijn zij, dus elke pool heeft 42 jaar dag en dan 42 jaar nacht.',
  },
  {
    speed: 16200, km: 4.3e9, name: 'Neptune', nameNl: 'Neptunus', stars: 5,
    photo: 'neptune',
    fact: 'The windiest place we know: 2,000 km an hour, in the dark, at 200 below.',
    factNl: 'De winderigste plek die we kennen: 2.000 km per uur, in het donker, bij 200 onder nul.',
  },
  {
    speed: 19900, km: 2.4e10, name: 'Out past the planets', nameNl: 'Voorbij de planeten', stars: 5,
    photo: 'pluto',
    fact: 'Voyager 1 left this way in 1977 and is still going. Nothing has ever gone further.',
    factNl: 'Voyager 1 vertrok zo in 1977 en gaat nog steeds door. Niets is ooit verder gekomen.',
  },
];

export function rungFor(speed: number): { rung: Milestone; index: number } {
  let index = 0;
  for (let i = 0; i < LADDER.length; i++) if (speed >= LADDER[i].speed) index = i;
  return { rung: LADDER[index], index };
}

export const nextRung = (index: number): Milestone | null => LADDER[index + 1] ?? null;

/**
 * How high a rocket coasts on the speed it has left. Past escape speed the sum has no answer,
 * which is the honest way of saying you are not coming back.
 */
export function coastHeight(speedUp: number, fromKm: number): number {
  const r0 = EARTH_R + fromKm * 1000;
  const esc = Math.sqrt(2 * G0 * EARTH_R * EARTH_R / r0);
  if (speedUp >= esc) return Infinity;
  const r = 1 / (1 / r0 - speedUp * speedUp / (2 * G0 * EARTH_R * EARTH_R));
  return (r - EARTH_R) / 1000;
}

/** A height as a child would say it. */
export function kmLabel(km: number, nl: boolean): string {
  if (!isFinite(km)) return nl ? 'verder dan we kunnen tellen' : 'further than we can count';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 1000) return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
  if (km < 1e6) return `${Math.round(km / 1000)}.000 km`;
  const mln = km / 1e6;
  return `${mln < 10 ? mln.toFixed(1) : Math.round(mln)} ${nl ? 'miljoen km' : 'million km'}`;
}

// ---------------------------------------------------------------- a rocket to start from

/** What is on the pad the very first time, so nobody opens the game to an empty grid. */
export const STARTER: Design = [
  { id: 'engine-s', col: CENTRE, row: 0 },
  { id: 'tank-s', col: CENTRE, row: 1 },
  { id: 'capsule', col: CENTRE, row: 3 },
];

/** Saved designs are plain data from localStorage, so nothing in them can be trusted. */
export function cleanDesign(raw: unknown): Design | null {
  if (!Array.isArray(raw) || !raw.length || raw.length > MAX_PARTS) return null;
  const out: Design = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') return null;
    const { id, col, row } = item as Record<string, unknown>;
    if (typeof id !== 'string' || !PARTS.some(p => p.id === id)) return null;
    if (typeof col !== 'number' || typeof row !== 'number') return null;
    const delay = (item as Record<string, unknown>).delay;
    const p: Placed = { id, col: Math.round(col), row: Math.round(row) };
    if (typeof delay === 'number' && isFinite(delay) && delay > 0) p.delay = clampDelay(delay);
    if (!inGrid(p)) return null;
    if (out.some(q => clash(p, q))) return null;
    out.push(p);
  }
  return isOnePiece(out) ? out : null;
}
