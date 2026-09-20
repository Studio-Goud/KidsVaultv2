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
  /** one line about what it is for */
  note: string;
  noteNl: string;
}

const P = (p: Partial<Part> & Pick<Part, 'id' | 'kind' | 'group' | 'name' | 'nameNl' | 'note' | 'noteNl'>): Part => ({
  rows: 1, w: 1, dry: 0, fuel: 0, burn: 0, exhaust: 3000, sharp: 0, ...p,
});

/**
 * Twenty-four parts, and every single one of them a trade.
 *
 * The tank volumes are real. One column is 1.8 m across and one row is 1.8 m tall, so a two-row
 * small tank is a cylinder of about 9 cubic metres - right for four and a half tonnes of kerosene
 * and liquid oxygen with ullage left at the top. The drawing and the numbers are the same rocket.
 *
 * The engines differ in two ways at once, which is the thing worth learning. Thrust gets you off
 * the ground. Exhaust speed decides how far you end up going. The big engine pushes nearly four
 * times harder than the small one and will never take you as far as the quiet vacuum engine, and
 * the nuclear engine pushes less than the big one and beats everything. NASA built and fired that
 * engine in the sixties and its exhaust really was about twice as fast as the best chemical one.
 */
export const PARTS: Part[] = [
  // ---- what rides on top
  P({
    id: 'nose', kind: 'nose', group: 'top', name: 'Nose cone', nameNl: 'Neuskegel',
    rows: 1, w: 1, dry: 0.1, sharp: 1,
    note: 'Almost weightless, and the air slides off it. Put one on every column.',
    noteNl: 'Bijna geen gewicht, en de lucht glijdt eraf. Zet er een op elke kolom.',
  }),
  P({
    id: 'probe', kind: 'pod', group: 'top', name: 'Probe', nameNl: 'Sonde',
    rows: 1, w: 0.7, dry: 0.25, sharp: 0.8,
    note: 'The lightest thing you can send. Nothing rides home in it.',
    noteNl: 'Het lichtste wat je kunt versturen. Er komt niemand mee terug.',
  }),
  P({
    id: 'capsule', kind: 'pod', group: 'top', name: 'Capsule', nameNl: 'Capsule',
    rows: 2, w: 0.9, dry: 0.8, sharp: 0.9,
    note: 'Room for one. Never falls away - it is what you are sending.',
    noteNl: 'Plek voor een. Valt nooit af: het is wat je verstuurt.',
  }),
  P({
    id: 'cabin', kind: 'pod', group: 'top', name: 'Big cabin', nameNl: 'Grote cabine',
    rows: 3, w: 1.1, dry: 2.2, sharp: 0.7,
    note: 'Room for a crew, and it weighs what a crew weighs.',
    noteNl: 'Plek voor een bemanning, en het weegt wat een bemanning weegt.',
  }),
  P({
    id: 'fairing', kind: 'nose', group: 'top', name: 'Fairing', nameNl: 'Neuskap',
    rows: 2, w: 1.38, dry: 0.6, sharp: 0.85,
    note: 'A wide shell to hide something fat under. Falls away with the stage.',
    noteNl: 'Een brede kap om iets diks onder te verstoppen. Valt met de trap mee af.',
  }),

  // ---- tanks
  P({
    id: 'tank-xs', kind: 'tank', group: 'tank', name: 'Tiny tank', nameNl: 'Minitank',
    rows: 1, w: 1, dry: 0.1, fuel: 2,
    note: 'Two tonnes. Good for topping a stage up to the height you want.',
    noteNl: 'Twee ton. Handig om een trap net zo hoog te maken als je wilt.',
  }),
  P({
    id: 'tank-s', kind: 'tank', group: 'tank', name: 'Small tank', nameNl: 'Kleine tank',
    rows: 2, w: 1, dry: 0.2, fuel: 4.5,
    note: 'Four and a half tonnes of fuel.',
    noteNl: 'Vierenhalve ton brandstof.',
  }),
  P({
    id: 'tank-m', kind: 'tank', group: 'tank', name: 'Medium tank', nameNl: 'Middeltank',
    rows: 3, w: 1, dry: 0.32, fuel: 7.5,
    note: 'Seven and a half tonnes, in the same width.',
    noteNl: 'Zevenenhalve ton, in dezelfde breedte.',
  }),
  P({
    id: 'tank-l', kind: 'tank', group: 'tank', name: 'Big tank', nameNl: 'Grote tank',
    rows: 4, w: 1, dry: 0.45, fuel: 11,
    note: 'Eleven tonnes. Tall rather than fat, which the air likes.',
    noteNl: 'Elf ton. Lang in plaats van dik, en dat vindt de lucht prettig.',
  }),
  P({
    id: 'tank-w', kind: 'tank', group: 'tank', name: 'Wide tank', nameNl: 'Brede tank',
    rows: 3, w: 1.4, dry: 0.7, fuel: 16,
    note: 'Sixteen tonnes in three rows - and a much bigger hole through the air.',
    noteNl: 'Zestien ton in drie rijen, maar ook een veel groter gat door de lucht.',
  }),
  P({
    id: 'tank-thin', kind: 'tank', group: 'tank', name: 'Slim tank', nameNl: 'Smalle tank',
    rows: 3, w: 0.62, dry: 0.16, fuel: 3.2,
    note: 'Narrow and slippery. Made for hanging beside the core.',
    noteNl: 'Smal en glad. Gemaakt om naast de kern te hangen.',
  }),

  // ---- engines
  P({
    id: 'engine-xs', kind: 'engine', group: 'engine', name: 'Tiny engine', nameNl: 'Minimotor',
    rows: 1, w: 0.7, dry: 0.2, burn: 0.06, exhaust: 2400,
    note: 'Barely lifts itself. Useful on top, where there is nothing left to lift.',
    noteNl: 'Tilt zichzelf amper op. Handig bovenin, waar niets meer te tillen valt.',
  }),
  P({
    id: 'engine-s', kind: 'engine', group: 'engine', name: 'Small engine', nameNl: 'Kleine motor',
    rows: 1, w: 1, dry: 0.5, burn: 0.17, exhaust: 2600,
    note: 'The one to start with. Lifts about forty tonnes of nothing else.',
    noteNl: 'Om mee te beginnen. Tilt ongeveer veertig ton en verder niets.',
  }),
  P({
    id: 'engine-l', kind: 'engine', group: 'engine', name: 'Big engine', nameNl: 'Grote motor',
    rows: 1, w: 1.06, dry: 1.3, burn: 0.55, exhaust: 3050,
    note: 'Four times the push of the small one, and nearly three times the weight.',
    noteNl: 'Vier keer zoveel duw als de kleine, en bijna drie keer zo zwaar.',
  }),
  P({
    id: 'engine-x', kind: 'engine', group: 'engine', name: 'Three engines', nameNl: 'Drie motoren',
    rows: 2, w: 1.3, dry: 2.8, burn: 1.55, exhaust: 2950,
    note: 'Brute force off the pad. Drinks the tank in seconds.',
    noteNl: 'Botte kracht bij het opstijgen. Drinkt de tank in seconden leeg.',
  }),
  P({
    id: 'engine-w', kind: 'engine', group: 'engine', name: 'Nine engines', nameNl: 'Negen motoren',
    rows: 2, w: 1.45, dry: 7, burn: 4.3, exhaust: 2980,
    note: 'A whole first stage in one piece. It will lift anything you can build.',
    noteNl: 'Een hele eerste trap in een stuk. Tilt alles op wat je kunt bouwen.',
  }),
  P({
    id: 'engine-h', kind: 'engine', group: 'engine', name: 'Hydrogen engine', nameNl: 'Waterstofmotor',
    rows: 2, w: 1.1, dry: 1.5, burn: 0.42, exhaust: 4400,
    note: 'Burns hydrogen, so the exhaust comes out fast. Strong and efficient at once.',
    noteNl: 'Verbrandt waterstof, dus de uitlaat gaat er snel uit. Sterk en zuinig tegelijk.',
  }),
  P({
    id: 'engine-v', kind: 'engine', group: 'engine', name: 'Vacuum engine', nameNl: 'Vacuummotor',
    rows: 2, w: 1, dry: 0.5, burn: 0.17, exhaust: 4000,
    note: 'A big soft bell, made for the emptiness. Quiet, and it goes furthest.',
    noteNl: 'Een grote zachte klok, gemaakt voor de leegte. Stil, en komt het verst.',
  }),
  P({
    id: 'engine-n', kind: 'engine', group: 'engine', name: 'Nuclear engine', nameNl: 'Kernmotor',
    rows: 2, w: 1.06, dry: 1.2, burn: 0.14, exhaust: 8000,
    note: 'Heats the fuel with a reactor. Twice the exhaust speed of anything chemical.',
    noteNl: 'Verhit de brandstof met een reactor. Twee keer zo snelle uitlaat als alles chemisch.',
  }),

  // ---- strap-on boosters: an engine and its fuel in one piece
  P({
    id: 'srb-s', kind: 'solid', group: 'booster', name: 'Small booster', nameNl: 'Kleine booster',
    rows: 2, w: 0.64, dry: 0.35, fuel: 5, burn: 0.62, exhaust: 2500, sharp: 0.7,
    note: 'Fuel and engine in one. Lights once, burns hard, cannot be turned off.',
    noteNl: 'Brandstof en motor in een. Gaat een keer aan, brandt hard, kan niet uit.',
  }),
  P({
    id: 'srb-l', kind: 'solid', group: 'booster', name: 'Big booster', nameNl: 'Grote booster',
    rows: 4, w: 0.74, dry: 0.75, fuel: 12, burn: 1.3, exhaust: 2550, sharp: 0.7,
    note: 'Twelve tonnes of solid fuel. Two of these will shift almost anything.',
    noteNl: 'Twaalf ton vaste brandstof. Twee hiervan krijgen bijna alles in beweging.',
  }),

  // ---- fins and odds and ends
  P({
    id: 'fin-s', kind: 'fin', group: 'extra', name: 'Small fins', nameNl: 'Kleine vinnen',
    rows: 1, w: 1.35, dry: 0.15,
    note: 'Keeps the nose pointing up in the thick air. Costs a little speed.',
    noteNl: 'Houdt de neus omhoog in de dikke lucht. Kost een beetje snelheid.',
  }),
  P({
    id: 'fin-l', kind: 'fin', group: 'extra', name: 'Big fins', nameNl: 'Grote vinnen',
    rows: 2, w: 1.7, dry: 0.4,
    note: 'Holds a wobbly rocket dead straight, and the air makes you pay for it.',
    noteNl: 'Houdt een wiebelige raket kaarsrecht, en de lucht laat je ervoor betalen.',
  }),
  P({
    id: 'adapter', kind: 'truss', group: 'extra', name: 'Adapter', nameNl: 'Tussenstuk',
    rows: 1, w: 1, dry: 0.12,
    note: 'A collar to set something narrow on something wide.',
    noteNl: 'Een kraag om iets smals op iets breeds te zetten.',
  }),
  P({
    id: 'truss', kind: 'truss', group: 'extra', name: 'Girder', nameNl: 'Vakwerk',
    rows: 2, w: 0.42, dry: 0.08,
    note: 'Open framework. Weighs next to nothing and holds things apart.',
    noteNl: 'Open frame. Weegt bijna niets en houdt dingen uit elkaar.',
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
  if (part.id !== 'nose') return part.w;
  let below: Part | null = null;
  let bestTop = -1;
  design.forEach((q, k) => {
    if (k === i || q.col !== p.col) return;
    const t = topRow(q);
    if (t + 1 !== p.row || t <= bestTop) return;
    bestTop = t;
    below = partById(q.id);
  });
  return below ? (below as Part).w : part.w;
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
        cur = { col, engine: i, parts: [i], thrust: p.burn * p.exhaust, burn: p.burn, fuel: p.fuel };
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
  for (const list of stagesByColumn(design).values()) if (list.length && list[0].fuel > 0) n += list[0].thrust;
  return n;
}

export const G0 = 9.81;
export const padWeight = (design: Design): number => totalMass(design) * G0;
export const canLift = (design: Design): boolean => padThrust(design) > padWeight(design) * 1.02;

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
    colWidth.set(p.col, Math.max(colWidth.get(p.col) ?? 0, w));
    const best = colTop.get(p.col);
    if (!best || topRow(p) > best.row) colTop.set(p.col, { row: topRow(p), sharp: part.sharp });
  });
  const width = Math.max(0.5, right - left);
  const height = Math.max(1, top - bottom);
  const fineness = height / width;

  const widest = Math.max(...colWidth.values(), 0.5);
  let area = 0, sharpSum = 0;
  for (const [col, w] of colWidth) {
    const a = circle(w) * (w === widest ? 1 : SIDE_EXPOSURE);
    area += a;
    sharpSum += a * (colTop.get(col)?.sharp ?? 0);
  }
  if (area <= 0) area = circle(widest);
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
  Math.max(0, Math.min(1, (3.4 - s.drag) / 2.5));

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
    return nl ? 'Geen motor die kan branden. Zet een motor onder een tank.'
      : 'No engine can fire. Put an engine under a tank.';
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
  speed: number;
  km: number;
  name: string;
  nameNl: string;
  stars: number;
}

/**
 * The ladder. Nothing is locked behind it - it is a set of names for how far you got, the way a
 * tape measure on a doorframe is a set of names for how tall you are.
 */
export const LADDER: Milestone[] = [
  { speed: 0, km: 0, name: 'The pad', nameNl: 'Het platform', stars: 0 },
  { speed: 140, km: 1, name: 'Up with the birds', nameNl: 'Bij de vogels', stars: 1 },
  { speed: 340, km: 6, name: 'Through the clouds', nameNl: 'Door de wolken', stars: 1 },
  { speed: 620, km: 20, name: 'Above the aeroplanes', nameNl: 'Boven de vliegtuigen', stars: 2 },
  { speed: 1390, km: 100, name: 'The edge of the air', nameNl: 'De rand van de lucht', stars: 2 },
  { speed: 2720, km: 400, name: 'Round the Earth', nameNl: 'Een rondje om de Aarde', stars: 3 },
  { speed: 6800, km: 8000, name: 'Past the satellites', nameNl: 'Voorbij de satellieten', stars: 3 },
  { speed: 10874, km: 384400, name: 'As far as the Moon', nameNl: 'Zo ver als de Maan', stars: 4 },
  { speed: 11200, km: 3.4e6, name: 'Away from the Earth', nameNl: 'Los van de Aarde', stars: 4 },
  { speed: 13000, km: 7.8e7, name: 'As far as Mars', nameNl: 'Zo ver als Mars', stars: 5 },
  { speed: 16600, km: 6.3e8, name: 'As far as Jupiter', nameNl: 'Zo ver als Jupiter', stars: 5 },
  { speed: 20000, km: 5e9, name: 'Out past the planets', nameNl: 'Voorbij de planeten', stars: 5 },
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
    const p: Placed = { id, col: Math.round(col), row: Math.round(row) };
    if (!inGrid(p)) return null;
    if (out.some(q => clash(p, q))) return null;
    out.push(p);
  }
  return isOnePiece(out) ? out : null;
}
