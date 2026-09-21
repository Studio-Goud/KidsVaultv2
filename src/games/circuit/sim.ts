/**
 * Stroomkring's rules: a netlist, and the sums that decide what happens in it.
 *
 * Nothing in this file draws anything or knows a screen exists. It takes a list of parts sitting
 * on a grid, works out what is joined to what, and solves the circuit the joins describe - so the
 * bulb that lights is the bulb the arithmetic says lights, and the one that stays dark is dark for
 * a reason a child can be told in one line.
 *
 * The model is the real one, kept as small as it can be and still be true:
 *
 * - Every part sits in a cell and has terminals on the faces of that cell. Two parts are joined
 *   when they are next to each other and both have a terminal on the face between them. A wire is
 *   a part with a terminal on all four faces, so it is a junction as well as a lead, which is how
 *   a child builds a branch without being told what a branch is.
 * - The joins are collapsed into nodes, the parts become edges between nodes, and the whole thing
 *   is solved by nodal analysis: G·V = I, one equation per node, Gaussian elimination.
 * - Every source has an internal resistance, which is why a wire laid straight across a battery
 *   draws nine amps instead of infinity, and why the fuse has something to blow at.
 * - A diode and a relay are not linear, so the solve is run again with their new states until they
 *   stop changing. Three or four passes is always enough for a board this size.
 *
 * Ohm's law does the teaching. Two bulbs in series share one current and each get a quarter of the
 * power; two in parallel each get their own current and burn at nearly full brightness, and the
 * battery pays for both. That single contrast is the point of the game, and it is not a special
 * case anywhere in here - it falls out of the sums.
 */

// ---------------------------------------------------------------- the board

export const COLS = 9;
export const ROWS = 6;
/** More parts than this and the board is a maze rather than a circuit. */
export const MAX_PARTS = 36;

/** Faces of a cell, clockwise from the top. */
export const N = 0, E = 1, S = 2, W = 3;
export const DX = [0, 1, 0, -1];
export const DY = [-1, 0, 1, 0];
export const opposite = (face: number): number => (face + 2) % 4;

export type Kind =
  | 'battery' | 'solar' | 'cap'
  | 'wire' | 'clip' | 'switch' | 'button' | 'fuse' | 'relay'
  | 'bulb' | 'led' | 'motor' | 'buzzer' | 'resistor';

export interface Spec {
  id: Kind;
  name: string;
  nameNl: string;
  note: string;
  noteNl: string;
  /** how many cells it covers: one for everything but the lead with the clips on it */
  len: number;
  /** ohms of the part itself */
  r: number;
  /** volts it pushes, for a source */
  volts: number;
  /** ohms inside the source, which is what stops a short circuit being infinite */
  rIn: number;
  /** which way round it goes matters */
  polar: boolean;
  /** the current or the power it is built for, so "how hard is it working" has an answer */
  rated: number;
  /** it does something you can see or hear when current goes through it */
  load: boolean;
}

const P = (s: Partial<Spec> & Pick<Spec, 'id' | 'name' | 'nameNl' | 'note' | 'noteNl'>): Spec => ({
  len: 1, r: 0.01, volts: 0, rIn: 0, polar: false, rated: 1, load: false, ...s,
});

/** How much of a volt a lit LED swallows before it will pass any current at all. */
export const LED_VF = 1.8;
/** A fuse is a thin wire that melts. This is the current it melts at. */
export const FUSE_BLOWS_AT = 1.5;
/** Above this the battery is being emptied rather than used: a short circuit. */
export const SHORT_AMPS = 2.5;
/** Amp-seconds in a fresh battery. A single bulb gets about three minutes out of one. */
export const BATTERY_CHARGE = 60;
/** Farads in the capacitor. Big, so a child can watch it fill and empty. */
export const CAP_FARADS = 0.5;
/** Amps through the coil before the relay pulls in. */
export const RELAY_PULL = 0.04;

export const PARTS: Spec[] = [
  P({
    id: 'battery', name: 'Battery', nameNl: 'Batterij',
    note: 'Four and a half volts, and a plus end and a minus end. It runs out.',
    noteNl: 'Vier en een halve volt, met een plus- en een minkant. Hij raakt op.',
    volts: 4.5, rIn: 0.5, r: 0.5, polar: true, rated: 1,
  }),
  P({
    id: 'wire', name: 'Wire', nameNl: 'Draad',
    note: 'Draw a line with your finger. It joins what it runs between, and branches where it forks.',
    noteNl: 'Trek een lijn met je vinger. Hij verbindt waar hij tussen loopt, en splitst waar je splitst.',
    r: 0.005,
  }),
  P({
    id: 'bulb', name: 'Bulb', nameNl: 'Lampje',
    note: 'Twelve ohms of glowing wire. The more current, the brighter.',
    noteNl: 'Twaalf ohm gloeiend draad. Hoe meer stroom, hoe feller.',
    r: 12, rated: 1.555, load: true,
  }),
  P({
    id: 'switch', name: 'Switch', nameNl: 'Schakelaar',
    note: 'Open is a gap in the loop. Closed is a piece of wire. Tap it.',
    noteNl: 'Open is een gat in de kring. Dicht is een stuk draad. Tik erop.',
    r: 0.02,
  }),
  P({
    id: 'button', name: 'Push button', nameNl: 'Drukknop',
    note: 'A switch that springs back. It is only closed while you hold it.',
    noteNl: 'Een schakelaar die terugveert. Alleen dicht zolang je hem vasthoudt.',
    r: 0.02,
  }),
  P({
    id: 'motor', name: 'Motor', nameNl: 'Motor',
    note: 'Eight ohms. Turn it round and it spins the other way.',
    noteNl: 'Acht ohm. Draai hem om en hij draait de andere kant op.',
    r: 8, rated: 0.529, polar: true, load: true,
  }),
  P({
    id: 'buzzer', name: 'Buzzer', nameNl: 'Zoemer',
    note: 'Twenty ohms of noise.',
    noteNl: 'Twintig ohm herrie.',
    r: 20, rated: 0.2195, load: true,
  }),
  P({
    id: 'led', name: 'LED', nameNl: 'Led',
    note: 'Only lights one way round. Backwards it lets nothing through at all.',
    noteNl: 'Brandt maar één kant op. Achterstevoren laat hij niets door.',
    r: 20, rated: 0.1317, polar: true, load: true,
  }),
  P({
    id: 'resistor', name: 'Resistor', nameNl: 'Weerstand',
    note: 'Forty-seven ohms in the way. Everything after it gets less.',
    noteNl: 'Zevenenveertig ohm in de weg. Alles erachter krijgt minder.',
    r: 47, rated: 0.44, load: true,
  }),
  P({
    id: 'fuse', name: 'Fuse', nameNl: 'Zekering',
    note: 'A thread that melts above one and a half amps, before anything else can.',
    noteNl: 'Een draadje dat smelt boven anderhalve ampère, voordat iets anders kapot kan.',
    r: 0.05, rated: FUSE_BLOWS_AT,
  }),
  P({
    id: 'solar', name: 'Solar cell', nameNl: 'Zonnecel',
    note: 'Three volts out of daylight, and it never runs out. Weaker than a battery.',
    noteNl: 'Drie volt uit daglicht, en hij raakt nooit op. Zwakker dan een batterij.',
    volts: 3, rIn: 1.2, r: 1.2, polar: true,
  }),
  P({
    id: 'cap', name: 'Capacitor', nameNl: 'Condensator',
    note: 'A little tank for electricity. Fills up, then empties again on its own.',
    noteNl: 'Een klein vat voor stroom. Loopt vol, en daarna vanzelf weer leeg.',
    r: 0.1, rIn: 0.1, polar: true,
  }),
  P({
    id: 'relay', name: 'Relay', nameNl: 'Relais',
    note: 'A coil that pulls a switch shut. A small circuit turning a big one on.',
    noteNl: 'Een spoel die een schakelaar dichttrekt. Een klein kringetje dat een groot aanzet.',
    r: 60, rated: RELAY_PULL,
  }),
  P({
    id: 'clip', name: 'Crocodile lead', nameNl: 'Krokodillenklem',
    note: 'A long lead with a clip on each end. Reaches two cells in one go.',
    noteNl: 'Een lang snoer met aan elk eind een klem. Overbrugt twee vakjes tegelijk.',
    len: 2, r: 0.01,
  }),
];

const SPECS = new Map(PARTS.map(p => [p.id, p]));
export const specOf = (id: Kind): Spec => SPECS.get(id) ?? PARTS[0];
export const isKind = (id: unknown): id is Kind => typeof id === 'string' && SPECS.has(id as Kind);

/** One part, in a cell, pointing a way. */
export interface Placed {
  id: Kind;
  col: number;
  row: number;
  /**
   * Which way it points, a quarter turn at a time.
   *
   * Terminal A sits on the face a quarter turn anticlockwise of `rot` and B a quarter turn
   * clockwise, so rot 0 is A on the west and B on the east, and rot 2 is the same part the other
   * way round - which is the whole of what polarity means here.
   */
  rot: number;
  /** a switch that is closed, a button that is held down */
  on?: boolean;
  /** a fuse whose thread has melted */
  blown?: boolean;
  /** amp-seconds left in a battery, coulombs in a capacitor */
  charge?: number;
  /**
   * For a wire: which of its four faces the line was drawn through, one bit per face.
   *
   * Two wires lying side by side do not touch, because the line was never drawn between them -
   * which is the only reason a child can run a circuit back past itself without shorting it out.
   * A wire always meets a proper terminal beside it, whatever was drawn, because that is what a
   * terminal is for.
   */
  link?: number;
}

export type Board = Placed[];

export const linked = (p: Placed, face: number): boolean => ((p.link ?? 0) & (1 << face)) !== 0;
export const withLink = (p: Placed, face: number): void => { p.link = (p.link ?? 0) | (1 << face); };

export const aFace = (p: Placed): number => (p.rot + 3) % 4;
export const bFace = (p: Placed): number => (p.rot + 1) % 4;

/** The cells a part covers. Everything is one cell but the crocodile lead, which is two. */
export function cellsOf(p: Placed): Array<[number, number]> {
  if (specOf(p.id).len === 1) return [[p.col, p.row]];
  return p.rot % 2 === 0
    ? [[p.col, p.row], [p.col + 1, p.row]]
    : [[p.col, p.row], [p.col, p.row + 1]];
}

export interface Pin { label: string; col: number; row: number; face: number }

/**
 * Where a part's terminals are.
 *
 * A wire has one on every face, which is what makes it a junction. A relay has four: the coil
 * across one axis and the contacts across the other, so one part really is two circuits meeting.
 */
export function pinsOf(p: Placed): Pin[] {
  const spec = specOf(p.id);
  if (p.id === 'wire') {
    return [0, 1, 2, 3].map(f => ({ label: 'NESW'[f], col: p.col, row: p.row, face: f }));
  }
  if (spec.len === 2) {
    const [c0, c1] = cellsOf(p);
    const out = p.rot % 2 === 0
      ? [{ label: 'A', col: c0[0], row: c0[1], face: W }, { label: 'B', col: c1[0], row: c1[1], face: E }]
      : [{ label: 'A', col: c0[0], row: c0[1], face: N }, { label: 'B', col: c1[0], row: c1[1], face: S }];
    return out;
  }
  const out: Pin[] = [
    { label: 'A', col: p.col, row: p.row, face: aFace(p) },
    { label: 'B', col: p.col, row: p.row, face: bFace(p) },
  ];
  if (p.id === 'relay') {
    // The coil takes two faces that meet at a corner and the contacts take the other two, so the
    // little circuit and the big one sit on opposite sides of the part. Terminals alternating round
    // the box would force the two loops to cross, and on a flat board they cannot.
    out[1] = { label: 'B', col: p.col, row: p.row, face: p.rot % 4 };
    out.push({ label: 'C', col: p.col, row: p.row, face: (p.rot + 1) % 4 });
    out.push({ label: 'D', col: p.col, row: p.row, face: (p.rot + 2) % 4 });
  }
  return out;
}

export const onBoard = (p: Placed): boolean =>
  cellsOf(p).every(([c, r]) => c >= 0 && c < COLS && r >= 0 && r < ROWS);

/** May this part go here: on the board, and on cells nobody else is using? */
export function canPlace(board: Board, p: Placed, skip = -1): boolean {
  if (!onBoard(p)) return false;
  const mine = cellsOf(p).map(([c, r]) => `${c},${r}`);
  for (let i = 0; i < board.length; i++) {
    if (i === skip) continue;
    for (const [c, r] of cellsOf(board[i])) if (mine.includes(`${c},${r}`)) return false;
  }
  return true;
}

/**
 * Lay one cell of a drawn line of wire, and tie it to the cell the line came from.
 *
 * This is the whole of how a wire gets onto the board: a finger moves across the cells and each
 * one it enters is added to the line behind it. Where the line meets something that is not a wire
 * it stops, because a terminal joins to whatever is beside it on its own.
 */
export function layWire(board: Board, col: number, row: number, from?: [number, number]): boolean {
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return false;
  let i = partAt(board, col, row);
  if (i < 0) {
    if (board.length >= MAX_PARTS) return false;
    board.push({ id: 'wire', col, row, rot: 0, link: 0 });
    i = board.length - 1;
  }
  if (!from) return board[i].id === 'wire';
  const k = partAt(board, from[0], from[1]);
  if (k < 0 || k === i) return false;
  const dc = col - from[0], dr = row - from[1];
  if (Math.abs(dc) + Math.abs(dr) !== 1) return false;
  const face = dc === 1 ? E : dc === -1 ? W : dr === 1 ? S : N;
  if (board[k].id === 'wire') withLink(board[k], face);
  if (board[i].id === 'wire') withLink(board[i], opposite(face));
  return true;
}

/** Which part, if any, is sitting on this cell. */
export function partAt(board: Board, col: number, row: number): number {
  for (let i = 0; i < board.length; i++) {
    for (const [c, r] of cellsOf(board[i])) if (c === col && r === row) return i;
  }
  return -1;
}

// ---------------------------------------------------------------- the netlist

interface Edge {
  /** the part this length of circuit belongs to */
  p: number;
  /** which piece of it: the part itself, a relay's coil or contacts, or one arm of a wire */
  tag: string;
  a: number;
  b: number;
  /** ohms */
  r: number;
  /** volts pushed from B towards A inside the part */
  e: number;
  open: boolean;
}

interface Net {
  edges: Edge[];
  nodes: number;
  /** the node each terminal ended up on, keyed `part:label` */
  nodeOf: Map<string, number>;
  /** how many terminals share each node: one means a loose end */
  pins: number[];
  /** for a wire, which of its faces actually meet something */
  joinedFaces: Map<number, number[]>;
}

class Union {
  private p: number[] = [];
  make(): number { this.p.push(this.p.length); return this.p.length - 1; }
  find(i: number): number { while (this.p[i] !== i) { this.p[i] = this.p[this.p[i]]; i = this.p[i]; } return i; }
  join(a: number, b: number): void { const x = this.find(a), y = this.find(b); if (x !== y) this.p[x] = y; }
}

/**
 * What is joined to what.
 *
 * Every terminal becomes a slot; two terminals facing each other across a cell edge become the
 * same node; and then each part contributes its lengths of circuit between those nodes. A wire is
 * a star: a hub with one short arm to every face that meets something, so each arm has a current
 * of its own and the drawing can show which way it goes.
 */
export function netlist(board: Board): Net {
  const u = new Union();
  const slot = new Map<string, number>();
  const at = new Map<string, { p: number; label: string }>();

  board.forEach((p, i) => {
    for (const pin of pinsOf(p)) {
      const k = `${i}:${pin.label}`;
      slot.set(k, u.make());
      at.set(`${pin.col},${pin.row}|${pin.face}`, { p: i, label: pin.label });
    }
  });

  const joinedFaces = new Map<number, number[]>();
  board.forEach((p, i) => {
    const faces: number[] = [];
    for (const pin of pinsOf(p)) {
      const nb = at.get(`${pin.col + DX[pin.face]},${pin.row + DY[pin.face]}|${opposite(pin.face)}`);
      if (!nb || nb.p === i) continue;
      // two lengths of wire only meet where the line was drawn between them
      if (p.id === 'wire' && board[nb.p].id === 'wire'
        && !(linked(p, pin.face) && linked(board[nb.p], opposite(pin.face)))) continue;
      u.join(slot.get(`${i}:${pin.label}`)!, slot.get(`${nb.p}:${nb.label}`)!);
      faces.push(pin.face);
    }
    if (p.id === 'wire') joinedFaces.set(i, faces);
  });

  // slots that ended up together become one numbered node
  const id = new Map<number, number>();
  const nodeOf = new Map<string, number>();
  const pins: number[] = [];
  for (const [k, s] of slot) {
    const root = u.find(s);
    let n = id.get(root);
    if (n === undefined) { n = pins.length; id.set(root, n); pins.push(0); }
    nodeOf.set(k, n);
    pins[n]++;
  }

  let nodes = pins.length;
  const edges: Edge[] = [];
  const node = (i: number, label: string): number => nodeOf.get(`${i}:${label}`)!;

  board.forEach((p, i) => {
    const spec = specOf(p.id);
    if (p.id === 'wire') {
      const faces = joinedFaces.get(i) ?? [];
      if (faces.length < 2) return;              // a wire going nowhere carries nothing
      const hub = nodes++;
      for (const f of faces) {
        edges.push({ p: i, tag: `w${f}`, a: hub, b: node(i, 'NESW'[f]), r: spec.r, e: 0, open: false });
      }
      return;
    }
    if (p.id === 'relay') {
      edges.push({ p: i, tag: 'coil', a: node(i, 'A'), b: node(i, 'B'), r: spec.r, e: 0, open: false });
      // the contacts start open; the pass over the diodes and relays below closes them
      edges.push({ p: i, tag: 'contact', a: node(i, 'C'), b: node(i, 'D'), r: specOf('switch').r, e: 0, open: true });
      return;
    }
    const open = (p.id === 'switch' || p.id === 'button') ? !p.on
      : p.id === 'fuse' ? !!p.blown
        : p.id === 'led' ? true                  // assumed off until the diode pass says otherwise
          : false;
    const e = p.id === 'battery' ? battVolts(chargeFrac(p))
      : p.id === 'solar' ? spec.volts
        : p.id === 'cap' ? (p.charge ?? 0) / CAP_FARADS
          : p.id === 'led' ? LED_VF
            : 0;
    edges.push({ p: i, tag: 'main', a: node(i, 'A'), b: node(i, 'B'), r: spec.r, e, open });
  });

  return { edges, nodes, nodeOf, pins, joinedFaces };
}

// ---------------------------------------------------------------- the sums

/** What a battery has left, as a fraction of a fresh one. */
export const chargeFrac = (p: Placed): number =>
  Math.max(0, Math.min(1, (p.charge ?? BATTERY_CHARGE) / BATTERY_CHARGE));

/**
 * What a battery pushes as it empties.
 *
 * A real cell sags under load as it goes, and then falls off a cliff at the end rather than
 * stopping dead. So the bulb dims for a while before it goes out, which is the thing a child
 * actually notices about a torch.
 */
export function battVolts(frac: number): number {
  const f = Math.max(0, Math.min(1, frac));
  if (f <= 0) return 0;
  return specOf('battery').volts * (0.72 + 0.28 * f) * Math.min(1, f / 0.12);
}

/** Solve G·V = I for the node voltages, by elimination with the biggest pivot each time. */
function gauss(G: number[][], I: number[]): number[] | null {
  const n = I.length;
  for (let c = 0; c < n; c++) {
    let best = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(G[r][c]) > Math.abs(G[best][c])) best = r;
    if (Math.abs(G[best][c]) < 1e-12) return null;
    if (best !== c) { const t = G[best]; G[best] = G[c]; G[c] = t; const s = I[best]; I[best] = I[c]; I[c] = s; }
    const piv = G[c][c];
    for (let r = c + 1; r < n; r++) {
      const f = G[r][c] / piv;
      if (f === 0) continue;
      for (let k = c; k < n; k++) G[r][k] -= f * G[c][k];
      I[r] -= f * I[c];
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = I[r];
    for (let k = r + 1; k < n; k++) s -= G[r][k] * x[k];
    x[r] = s / G[r][r];
  }
  return x;
}

/**
 * Node voltages for a whole board, one island of circuit at a time.
 *
 * Each connected piece is solved on its own with its lowest node held at nought volts, because a
 * piece of circuit with nothing joining it to the rest has no opinion about what the rest is doing
 * and asking the two questions at once has no single answer.
 */
function nodeVolts(nodes: number, edges: Edge[]): number[] {
  const live = edges.filter(e => !e.open && e.r > 0);
  const comp = new Int32Array(nodes).fill(-1);
  const near: number[][] = Array.from({ length: nodes }, () => []);
  live.forEach((e, k) => { near[e.a].push(k); near[e.b].push(k); });

  const v = new Array<number>(nodes).fill(0);
  let group = 0;
  for (let start = 0; start < nodes; start++) {
    if (comp[start] >= 0) continue;
    const list: number[] = [start];
    comp[start] = group;
    for (let q = 0; q < list.length; q++) {
      for (const k of near[list[q]]) {
        const o = live[k].a === list[q] ? live[k].b : live[k].a;
        if (comp[o] < 0) { comp[o] = group; list.push(o); }
      }
    }
    group++;
    if (list.length < 2) continue;

    // the first node of the island is the one everything else is measured against
    const idx = new Map<number, number>();
    list.slice(1).forEach((n, i) => idx.set(n, i));
    const m = list.length - 1;
    const G: number[][] = Array.from({ length: m }, () => new Array<number>(m).fill(0));
    const I = new Array<number>(m).fill(0);
    for (const e of live) {
      if (comp[e.a] !== comp[start]) continue;
      const g = 1 / e.r;
      const a = idx.get(e.a), b = idx.get(e.b);
      if (a !== undefined) { G[a][a] += g; I[a] += e.e * g; }
      if (b !== undefined) { G[b][b] += g; I[b] -= e.e * g; }
      if (a !== undefined && b !== undefined) { G[a][b] -= g; G[b][a] -= g; }
    }
    const x = gauss(G, I);
    if (!x) continue;
    list.slice(1).forEach((n, i) => { v[n] = x[i]; });
  }
  return v;
}

export interface PartState {
  /** amps through it, from terminal A to terminal B inside the part */
  i: number;
  /** volts across it, A minus B */
  v: number;
  /** watts it is turning into light, noise or heat */
  power: number;
  /** how hard it is working against what it is built for, where one is full */
  duty: number;
  /** it is doing its job right now */
  on: boolean;
  /** amps through a relay's contacts, which is a second circuit in the same part */
  i2?: number;
  /** amps into the hub of a wire from each of its four faces */
  faces?: number[];
}

export type FaultKind = 'nosource' | 'flat' | 'fuse' | 'short' | 'switchoff' | 'ledback' | 'gap' | 'loose';

export interface Fault {
  kind: FaultKind;
  /** which part to point at, or -1 */
  at: number;
}

export interface Sim {
  parts: PartState[];
  /** amps coming out of every source together */
  drawn: number;
  /** amps out of the batteries alone, which is what empties them */
  fromBattery: number;
  short: boolean;
  /** a fuse melted in this solve */
  blew: number[];
  fault: Fault | null;
  /** how many node voltages there were, for the debug handle */
  nodes: number;
}

const ZERO: PartState = { i: 0, v: 0, power: 0, duty: 0, on: false };

/** Work out what the board is doing, diodes and relays and all. */
export function solve(board: Board, findFault = true): Sim {
  const net = netlist(board);
  const led = new Map<number, boolean>();
  const relay = new Map<number, boolean>();
  board.forEach((p, i) => { if (p.id === 'led') led.set(i, false); if (p.id === 'relay') relay.set(i, false); });

  let v: number[] = [];
  for (let pass = 0; pass < 12; pass++) {
    for (const e of net.edges) {
      if (e.tag === 'main' && board[e.p].id === 'led') e.open = !led.get(e.p);
      if (e.tag === 'contact') e.open = !relay.get(e.p);
    }
    v = nodeVolts(net.nodes, net.edges);
    let changed = false;
    for (const e of net.edges) {
      if (e.tag === 'main' && board[e.p].id === 'led') {
        const want = led.get(e.p)
          ? (v[e.a] - v[e.b] - e.e) / e.r > 1e-9          // still being pushed the right way
          : v[e.a] - v[e.b] > LED_VF;                      // enough volts to open it
        if (want !== led.get(e.p)) { led.set(e.p, want); changed = true; }
      }
      if (e.tag === 'coil') {
        const want = Math.abs((v[e.a] - v[e.b]) / e.r) >= RELAY_PULL;
        if (want !== relay.get(e.p)) { relay.set(e.p, want); changed = true; }
      }
    }
    if (!changed) break;
  }

  const parts: PartState[] = board.map(() => ({ ...ZERO }));
  let drawn = 0, fromBattery = 0;
  const blew: number[] = [];

  for (const e of net.edges) {
    const p = board[e.p];
    const spec = specOf(p.id);
    const i = e.open ? 0 : (v[e.a] - v[e.b] - e.e) / e.r;
    const st = parts[e.p];
    if (e.tag.startsWith('w')) {
      st.faces = st.faces ?? [0, 0, 0, 0];
      st.faces[Number(e.tag.slice(1))] = -i;     // what flows into the hub from that face
      st.i = Math.max(st.i, Math.abs(i));        // a wire's own reading is how much it is carrying
      st.duty = Math.min(1, st.i / SHORT_AMPS);
      st.on = st.i > 0.01;
      continue;
    }
    if (e.tag === 'contact') {
      st.i2 = i;
      continue;
    }
    st.i = i;
    st.v = v[e.a] - v[e.b];
    st.power = i * i * spec.r;
    if (p.id === 'battery' || p.id === 'solar' || p.id === 'cap') {
      const out = -i;                             // current leaving the plus terminal
      st.duty = Math.min(1, Math.abs(out) / 2);
      st.on = out > 0.005;
      if (out > 0) drawn += out;
      if (p.id === 'battery' && out > 0) fromBattery += out;
      continue;
    }
    if (p.id === 'bulb') { st.duty = Math.min(1.6, st.power / spec.rated); st.on = st.duty > 0.05; continue; }
    if (p.id === 'led') { st.duty = Math.min(1.6, i / spec.rated); st.on = i > 0.004; continue; }
    if (p.id === 'fuse') {
      st.duty = Math.min(1.6, Math.abs(i) / spec.rated);
      st.on = !p.blown;
      if (!p.blown && Math.abs(i) > FUSE_BLOWS_AT) blew.push(e.p);
      continue;
    }
    if (p.id === 'relay') {
      st.duty = Math.min(1.6, Math.abs(i) / spec.rated);
      st.on = Math.abs(i) >= RELAY_PULL;
      continue;
    }
    st.duty = Math.min(1.6, Math.abs(i) / spec.rated);
    st.on = st.duty > 0.05;
  }

  const sim: Sim = {
    parts, drawn, fromBattery, short: drawn > SHORT_AMPS, blew,
    fault: null, nodes: net.nodes,
  };
  if (findFault) sim.fault = faultOf(board, sim, net);
  return sim;
}

// ---------------------------------------------------------------- what is wrong with it

const sources = (board: Board): number[] =>
  board.map((p, i) => (p.id === 'battery' || p.id === 'solar' ? i : -1)).filter(i => i >= 0);

const working = (board: Board, sim: Sim): boolean =>
  board.some((p, i) => specOf(p.id).load && sim.parts[i].duty > 0.05);

/** Every node the current can reach from a source, through whatever is closed right now. */
function reach(net: Net, from: number[]): Set<number> {
  const near = new Map<number, number[]>();
  const link = (a: number, b: number): void => {
    const list = near.get(a);
    if (list) list.push(b); else near.set(a, [b]);
  };
  for (const e of net.edges) {
    if (e.open) continue;
    link(e.a, e.b);
    link(e.b, e.a);
  }
  const seen = new Set<number>();
  const queue: number[] = [];
  for (const i of from) {
    for (const label of ['A', 'B']) {
      const n = net.nodeOf.get(`${i}:${label}`);
      if (n !== undefined && !seen.has(n)) { seen.add(n); queue.push(n); }
    }
  }
  for (let q = 0; q < queue.length; q++) {
    for (const n of near.get(queue[q]) ?? []) if (!seen.has(n)) { seen.add(n); queue.push(n); }
  }
  return seen;
}

/**
 * The one line, and the place to point it at.
 *
 * Checked in the order somebody looking at the bench would check it: is there a battery, has it
 * got anything left, has something burnt out, is it being emptied down a wire, is a switch simply
 * off, is the LED round the wrong way - and only then the tedious one, which is that the loop is
 * not a loop. Each of the middle three is answered by trying it: close every switch and solve it
 * again, turn the LED round and solve it again. If that would have worked, that was the problem.
 */
export function faultOf(board: Board, sim: Sim, net?: Net): Fault | null {
  if (!board.length) return null;
  const src = sources(board);
  if (!src.length) return { kind: 'nosource', at: -1 };

  const blown = board.findIndex(p => p.id === 'fuse' && p.blown);
  if (blown >= 0) return { kind: 'fuse', at: blown };
  if (sim.short) {
    const wire = board.findIndex((p, i) => p.id === 'wire' && Math.abs(sim.parts[i].i) > SHORT_AMPS);
    return { kind: 'short', at: wire >= 0 ? wire : src[0] };
  }
  // a cell with a whisper left in it is flat, but only once nothing on the board is still working:
  // a bulb that is visibly dimming is a better thing to look at than a sentence about it
  if (working(board, sim)) return null;
  const flat = board.findIndex(p => p.id === 'battery' && chargeFrac(p) < 0.02);
  if (flat >= 0 && !board.some(p => p.id === 'solar')) return { kind: 'flat', at: flat };

  // would it work if every switch were closed? then the one that carries current is the one that is off
  const open = board.map((p, i) => ((p.id === 'switch' || p.id === 'button') && !p.on ? i : -1)).filter(i => i >= 0);
  if (open.length) {
    const test = board.map(p => ({ ...p, on: p.id === 'switch' || p.id === 'button' ? true : p.on }));
    const after = solve(test, false);
    if (working(test, after)) {
      const guilty = open.find(i => Math.abs(after.parts[i].i) > 0.004);
      return { kind: 'switchoff', at: guilty ?? open[0] };
    }
  }

  // would it work with an LED the other way round?
  const leds = board.map((p, i) => (p.id === 'led' ? i : -1)).filter(i => i >= 0);
  for (const i of leds) {
    const test = board.map((p, k) => (k === i ? { ...p, rot: (p.rot + 2) % 4 } : { ...p }));
    const after = solve(test, false);
    if (after.parts[i].on || working(test, after)) return { kind: 'ledback', at: i };
  }

  // no switch and no diode to blame: the loop has a hole in it, and this is where
  const nn = net ?? netlist(board);
  const live = reach(nn, src);
  const ends: number[] = [];
  board.forEach((p, i) => {
    if (p.id === 'wire') {
      if ((nn.joinedFaces.get(i) ?? []).length < 2) ends.push(i);
      return;
    }
    const labels = p.id === 'relay' ? ['A', 'B', 'C', 'D'] : ['A', 'B'];
    if (labels.some(l => nn.pins[nn.nodeOf.get(`${i}:${l}`)!] === 1)) ends.push(i);
  });
  // a source with nothing whatever on either end is not a gap in a loop, it is a part in a field
  const dangling = (i: number, l: string): boolean => nn.pins[nn.nodeOf.get(`${i}:${l}`)!] === 1;
  const alone = src.find(i => dangling(i, 'A') && dangling(i, 'B'));
  if (alone !== undefined) return { kind: 'loose', at: alone };
  if (!ends.length) return null;

  // otherwise point at a loose end the current has already reached, and not at the battery itself
  const touched = (i: number): boolean => ['A', 'B', 'C', 'D']
    .some(l => { const n = nn.nodeOf.get(`${i}:${l}`); return n !== undefined && live.has(n); });
  const at = ends.find(i => !src.includes(i) && touched(i)) ?? ends.find(touched) ?? ends[0];
  return { kind: 'gap', at };
}

/** What that fault says out loud, in one line, in the language the child is reading. */
export function faultLine(f: Fault, nl: boolean): string {
  switch (f.kind) {
    case 'nosource':
      return nl ? 'Er is nog geen batterij op het bord.' : 'There is no battery on the board yet.';
    case 'loose':
      return nl ? 'De batterij zit nog nergens aan vast.' : 'The battery is not joined to anything yet.';
    case 'gap':
      return nl ? 'Hier zit een gat in de kring.' : 'There is a gap in the loop here.';
    case 'switchoff':
      return nl ? 'Deze schakelaar staat uit.' : 'This switch is off.';
    case 'ledback':
      return nl ? 'De led zit achterstevoren.' : 'The LED is the wrong way round.';
    case 'short':
      return nl ? 'Dit is kortsluiting: de stroom gaat om alles heen.'
        : 'This is a short circuit: the current goes round everything.';
    case 'fuse':
      return nl ? 'De zekering is doorgeslagen. Vervang hem.'
        : 'The fuse has blown. Put a new one in.';
    case 'flat':
      return nl ? 'De batterij is leeg.' : 'The battery is flat.';
  }
}

// ---------------------------------------------------------------- time passing

export interface Tick {
  /** fuses that melted this instant */
  blew: number[];
  /** a battery went flat this instant */
  wentFlat: boolean;
}

/**
 * Let the clock run on the board.
 *
 * The battery loses exactly the charge that came out of it, so a wasteful circuit really does run
 * out sooner - two bulbs in parallel empty it in half the time two in series do, and a short empties
 * it in seconds. The capacitor gains and loses exactly the charge that went through it, so it fills
 * up while the switch is closed and lights the bulb on its own for a moment after it opens.
 */
export function advance(board: Board, sim: Sim, dt: number): Tick {
  const out: Tick = { blew: [], wentFlat: false };
  const step = Math.max(0, Math.min(0.25, dt));
  board.forEach((p, i) => {
    if (p.id === 'battery') {
      const was = chargeFrac(p);
      const used = Math.max(0, -sim.parts[i].i) * step;
      let left = Math.max(0, (p.charge ?? BATTERY_CHARGE) - used);
      // The last half per cent is thrown away rather than chased. A cell whose volts fall away as
      // it empties draws less and less, so its charge creeps towards nought without ever getting
      // there - and a battery that is for ever nearly flat is a battery the game can never say is.
      if (left < BATTERY_CHARGE * 0.005) left = 0;
      p.charge = left;
      if (was > 0 && chargeFrac(p) <= 0) out.wentFlat = true;
    } else if (p.id === 'cap') {
      const gained = sim.parts[i].i * step;        // current in at the plus plate fills it
      p.charge = Math.max(0, Math.min(CAP_FARADS * 6, (p.charge ?? 0) + gained));
    } else if (p.id === 'fuse' && !p.blown && Math.abs(sim.parts[i].i) > FUSE_BLOWS_AT) {
      p.blown = true;
      out.blew.push(i);
    }
  });
  return out;
}

/** A fresh battery in every holder, and a new thread in every fuse. */
export function renew(board: Board): void {
  for (const p of board) {
    if (p.id === 'battery') p.charge = BATTERY_CHARGE;
    if (p.id === 'fuse') p.blown = false;
    if (p.id === 'cap') p.charge = 0;
  }
}

// ---------------------------------------------------------------- what the board has shown you

/**
 * What is true of the board this instant, as a handful of words.
 *
 * A puzzle is a list of these that all have to have happened at some point, which is the only way
 * to ask for something that takes two moments - a bulb that goes out while the other stays on, a
 * motor that has run both ways, a buzzer that stops when you let go.
 */
export function marksOf(board: Board, sim: Sim): string[] {
  const out = new Set<string>();
  const bulbs = board.map((p, i) => (p.id === 'bulb' ? i : -1)).filter(i => i >= 0);
  const lit = bulbs.filter(i => sim.parts[i].duty > 0.25);
  const dark = bulbs.filter(i => sim.parts[i].duty <= 0.05);
  if (lit.length >= 1) out.add('lit');
  if (lit.length >= 2) out.add('twolit');
  if (lit.length >= 2 && lit.every(i => sim.parts[i].duty > 0.6)) out.add('twobright');
  if (lit.length >= 1 && dark.length >= 1) out.add('onelitonedark');

  const sw = board.map((p, i) => ((p.id === 'switch' || p.id === 'button') ? i : -1)).filter(i => i >= 0);
  if (sw.some(i => !board[i].on) && bulbs.length > 0 && lit.length === 0) out.add('switchoff');

  for (const [i, p] of board.entries()) {
    const st = sim.parts[i];
    if (p.id === 'motor' && Math.abs(st.duty) > 0.15) out.add(st.i > 0 ? 'motorfwd' : 'motorback');
    if (p.id === 'buzzer' && st.duty > 0.2) out.add('buzz');
    if (p.id === 'led' && st.duty > 0.15) out.add('ledon');
    if (p.id === 'fuse' && p.blown) out.add('fuseblew');
    if (p.id === 'relay' && st.on && Math.abs(st.i2 ?? 0) > 0.02) out.add('relayon');
  }

  // a buzzer that only sounds while the button is held: both halves have to be seen
  const held = board.some(p => p.id === 'button' && p.on);
  const buzzing = board.some((p, i) => p.id === 'buzzer' && sim.parts[i].duty > 0.2);
  if (board.some(p => p.id === 'buzzer') && board.some(p => p.id === 'button')) {
    if (held && buzzing) out.add('buzzheld');
    if (!held && !buzzing) out.add('quietwhenlet');
  }

  // an LED that is in the loop and dark because it is round the wrong way
  if (sim.fault?.kind === 'ledback') out.add('ledback');
  if (sim.short) out.add('shorted');
  return [...out];
}

// ---------------------------------------------------------------- the ladder

export interface Puzzle {
  id: string;
  goal: string;
  goalNl: string;
  hint: string;
  hintNl: string;
  /** what the shelf offers for this one */
  tray: Kind[];
  /** what is already on the board when it opens */
  start: Board;
  /** marks that all have to have happened */
  needs: string[];
  /** the last one: everything unlocked and nothing to prove */
  free?: boolean;
  /** open challenges, for the free bench */
  extras?: Array<[string, string]>;
}

const at = (id: Kind, col: number, row: number, rot = 0, on?: boolean): Placed =>
  (on === undefined ? { id, col, row, rot } : { id, col, row, rot, on });

export const PUZZLES: Puzzle[] = [
  {
    id: 'light',
    goal: 'Make the bulb light.',
    goalNl: 'Laat het lampje branden.',
    hint: 'The current has to leave the battery, go through the bulb and come back. All the way round.',
    hintNl: 'De stroom moet de batterij uit, door het lampje, en er weer in. Helemaal rond.',
    tray: ['wire', 'bulb', 'clip'],
    start: [at('battery', 2, 2), at('bulb', 6, 2)],
    needs: ['lit'],
  },
  {
    id: 'switch',
    goal: 'Put a switch in, so you can turn it off.',
    goalNl: 'Zet er een schakelaar in, zodat je hem uit kunt doen.',
    hint: 'A switch is a gap you can close. Tap it to open and shut it.',
    hintNl: 'Een schakelaar is een gat dat je dicht kunt doen. Tik erop om hem open en dicht te zetten.',
    tray: ['wire', 'bulb', 'switch', 'clip'],
    start: [at('battery', 2, 2), at('bulb', 6, 2)],
    needs: ['lit', 'switchoff'],
  },
  {
    id: 'series',
    goal: 'Two bulbs, both lit.',
    goalNl: 'Twee lampjes, allebei aan.',
    hint: 'One after the other they share one current, so each one is dimmer. That is a series circuit.',
    hintNl: 'Achter elkaar delen ze één stroom, dus elk lampje is zwakker. Dat heet in serie.',
    tray: ['wire', 'bulb', 'switch', 'clip'],
    start: [at('battery', 2, 2), at('bulb', 5, 2), at('bulb', 7, 2)],
    needs: ['twolit'],
  },
  {
    id: 'parallel',
    goal: 'Two bulbs, and one may go out while the other stays on.',
    goalNl: 'Twee lampjes, en één mag uitgaan terwijl de ander blijft branden.',
    hint: 'Give each bulb its own way back to the battery. Then each one has a current of its own.',
    hintNl: 'Geef elk lampje zijn eigen weg terug naar de batterij. Dan heeft elk lampje een eigen stroom.',
    tray: ['wire', 'bulb', 'switch', 'clip'],
    start: [at('battery', 1, 3), at('bulb', 5, 1, 1), at('bulb', 5, 4, 1)],
    needs: ['twolit', 'onelitonedark'],
  },
  {
    id: 'motor',
    goal: 'Make the motor run one way, and then the other.',
    goalNl: 'Laat de motor de ene kant op draaien, en daarna de andere.',
    hint: 'Current has a direction. Tap the motor to turn it round and watch which way it spins.',
    hintNl: 'Stroom heeft een richting. Tik op de motor om hem om te draaien en kijk welke kant hij op gaat.',
    tray: ['wire', 'switch', 'motor', 'clip'],
    start: [at('battery', 2, 2), at('motor', 6, 2)],
    needs: ['motorfwd', 'motorback'],
  },
  {
    id: 'bell',
    goal: 'A doorbell: it buzzes only while the button is held.',
    goalNl: 'Een deurbel: hij zoemt alleen zolang je de knop indrukt.',
    hint: 'A push button springs back on its own. Hold it down to hear it, let go to stop it.',
    hintNl: 'Een drukknop veert vanzelf terug. Houd hem ingedrukt om hem te horen, laat los om te stoppen.',
    tray: ['wire', 'button', 'buzzer', 'clip'],
    start: [at('battery', 2, 2), at('buzzer', 6, 2)],
    needs: ['buzzheld', 'quietwhenlet'],
  },
  {
    id: 'fuse',
    goal: 'Put a fuse in, then short the battery out on purpose.',
    goalNl: 'Zet er een zekering in, en maak daarna expres kortsluiting.',
    hint: 'A wire straight across the battery lets the current go round everything. The fuse melts before anything else can.',
    hintNl: 'Een draad dwars over de batterij laat de stroom om alles heen gaan. De zekering smelt voordat er iets anders kapot kan.',
    tray: ['wire', 'bulb', 'fuse', 'switch', 'clip'],
    start: [at('battery', 2, 2), at('bulb', 6, 2)],
    needs: ['fuseblew'],
  },
  {
    id: 'led',
    goal: 'An LED lights one way round only. Show both.',
    goalNl: 'Een led brandt maar één kant op. Laat beide kanten zien.',
    hint: 'Tap the LED to turn it round. One way it lights, the other way nothing happens at all.',
    hintNl: 'Tik op de led om hem om te draaien. De ene kant op brandt hij, de andere kant op gebeurt er niets.',
    tray: ['wire', 'led', 'resistor', 'switch', 'clip'],
    start: [at('battery', 2, 2), at('led', 6, 2, 2)],
    needs: ['ledon', 'ledback'],
  },
  {
    id: 'relay',
    goal: 'A relay: a small circuit switching a big one on.',
    goalNl: 'Een relais: een klein kringetje dat een groot kringetje aanzet.',
    hint: 'The coil goes in one loop, the bulb in the other. When the coil pulls, the second loop closes.',
    hintNl: 'De spoel zit in het ene kringetje, het lampje in het andere. Als de spoel trekt, gaat het tweede kringetje dicht.',
    tray: ['wire', 'relay', 'switch', 'bulb', 'motor', 'battery', 'clip'],
    start: [at('battery', 1, 2), at('relay', 4, 2), at('battery', 7, 2, 2), at('bulb', 7, 4)],
    needs: ['relayon'],
  },
  {
    id: 'bench',
    goal: 'The workbench. Everything is here, and nothing has to be proved.',
    goalNl: 'De werkbank. Alles ligt klaar, en er hoeft niets bewezen te worden.',
    hint: 'Build whatever you like. It stays here when you close the game.',
    hintNl: 'Bouw wat je wilt. Het blijft staan als je het spel afsluit.',
    tray: ['wire', 'clip', 'battery', 'solar', 'cap', 'switch', 'button', 'fuse', 'relay', 'bulb', 'led', 'motor', 'buzzer', 'resistor'],
    start: [at('battery', 2, 2), at('bulb', 6, 2)],
    needs: [],
    free: true,
    extras: [
      ['Run the motor and light the bulb at once, on one battery, for as long as you can.',
        'Laat de motor draaien én het lampje branden, met één batterij, zo lang mogelijk.'],
      ['Light a bulb from the solar cell alone.', 'Laat een lampje branden op alleen de zonnecel.'],
      ['Charge the capacitor, then open the switch and watch the bulb fade.',
        'Laad de condensator op, doe dan de schakelaar open en kijk hoe het lampje uitdooft.'],
      ['Make a bulb you can turn on from two different switches.',
        'Maak een lampje dat je met twee verschillende schakelaars aan kunt doen.'],
    ],
  },
];

export const puzzleById = (id: string): Puzzle => PUZZLES.find(p => p.id === id) ?? PUZZLES[0];

/** Is every mark this puzzle asks for in the set of things that have happened? */
export const isSolved = (p: Puzzle, seen: ReadonlySet<string>): boolean =>
  !p.free && p.needs.length > 0 && p.needs.every(n => seen.has(n));

/** A fresh copy of a puzzle's opening board, so the list itself is never edited. */
export const startBoard = (p: Puzzle): Board =>
  p.start.map(q => ({ ...q, charge: q.id === 'battery' ? BATTERY_CHARGE : q.charge }));

// ---------------------------------------------------------------- what was saved

/**
 * A board out of localStorage is plain data somebody could have typed, so none of it is trusted:
 * every part has to be a part, every cell has to be on the board, and nothing may sit on top of
 * anything else. Anything else and the bench opens empty rather than broken.
 */
export function cleanCircuit(raw: unknown): Board | null {
  if (!Array.isArray(raw) || raw.length > MAX_PARTS) return null;
  const out: Board = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') return null;
    const o = item as Record<string, unknown>;
    if (!isKind(o.id)) return null;
    if (typeof o.col !== 'number' || typeof o.row !== 'number' || typeof o.rot !== 'number') return null;
    if (!isFinite(o.col) || !isFinite(o.row) || !isFinite(o.rot)) return null;
    const p: Placed = {
      id: o.id,
      col: Math.round(o.col),
      row: Math.round(o.row),
      rot: ((Math.round(o.rot) % 4) + 4) % 4,
    };
    if (specOf(p.id).len === 2) p.rot = p.rot % 2;
    if (o.on === true) p.on = true;
    if (o.blown === true) p.blown = true;
    if (p.id === 'wire' && typeof o.link === 'number' && isFinite(o.link)) {
      p.link = Math.max(0, Math.min(15, Math.round(o.link)));
    }
    if (typeof o.charge === 'number' && isFinite(o.charge) && o.charge >= 0) {
      p.charge = Math.min(o.charge, p.id === 'battery' ? BATTERY_CHARGE : CAP_FARADS * 6);
    }
    if (!canPlace(out, p)) return null;
    out.push(p);
  }
  return out;
}
