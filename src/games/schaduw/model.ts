/**
 * Schaduwspel - the rules, with nothing of the screen in them.
 *
 * An object stands on a turntable between a lamp and a wall. The child turns it until its shadow
 * fits the dark shape already on the wall. The shadow is not a drawing of a shadow: every object
 * here is a small 3D model (points and faces), and `project` throws each point from the lamp
 * through the point onto the wall, so a teapot turned a quarter really does show its spout.
 *
 * Decisions this file embodies (docs/decisions.md style, short):
 *  - The target is always something the child can reach: it is the projection of the same model at
 *    a yaw and pitch the game picked, never a drawing. A hint can therefore always say which way.
 *  - "Fits" is `matchScore` over rasterised masks, forgiving by one grid cell, because a four-year-old
 *    turning a thumb across glass cannot land on a pixel and a thin bicycle would otherwise be
 *    impossible. The thresholds are product decisions, tuned by hand, not research.
 *  - Nothing is ever wrong. The only help is an arrow after HINT_AFTER seconds; stars count the
 *    objects that needed fewer than two hints. Finishing a level is always worth at least one star.
 *
 * It practises seeing a shape from its outline and turning a thing in the mind (mental rotation).
 * It does not claim to teach it.
 */

import { makeRng } from '../../util/rng';

export type V3 = [number, number, number];
export interface P2 { x: number; y: number }
/** One polygon of a shadow, in wall coordinates (x along the wall, y up). */
export type Poly = P2[];
export type Shadow = Poly[];

export interface Lamp { x: number; y: number; z: number }
export interface Wall { x: number }

/** The lamp sits level with the middle of the object, far enough away that the shadow is not huge. */
export const LAMP: Lamp = { x: -5, y: 0, z: 0 };
export const WALL: Wall = { x: 3 };
/** The wall window is a square from -WALL_R to +WALL_R on both axes, in wall units. */
export const WALL_R = 2.4;
/** The mask the scores are made on. 40 x 40 is 0.12 wall units a cell: fine enough to tell a spout from a handle. */
export const GRID = 40;

const TAU = Math.PI * 2;

// ---------------------------------------------------------------- meshes

export interface ObjectModel {
  id: string;
  name: string;
  nameNl: string;
  /** what Suri says when it fits */
  line: string;
  lineNl: string;
  colour: string;
  pts: V3[];
  faces: number[][];
  /** the colour of each face, so a beak can be orange on a yellow duck */
  faceColour: string[];
}

class Mesh {
  pts: V3[] = [];
  faces: number[][] = [];
  cols: string[] = [];
  col = '#ffffff';

  constructor(base: string) { this.col = base; }
  paint(c: string): this { this.col = c; return this; }
  p(x: number, y: number, z: number): number { this.pts.push([x, y, z]); return this.pts.length - 1; }
  f(ids: number[]): void { this.faces.push(ids); this.cols.push(this.col); }

  /** A solid of revolution about the vertical axis; `profile` is [radius, height] pairs from the bottom up. */
  lathe(profile: Array<[number, number]>, seg: number, c: V3 = [0, 0, 0], sx = 1, sz = 1, sy = 1): this {
    const rings: number[][] = [];
    for (const [r, y] of profile) {
      const ring: number[] = [];
      for (let i = 0; i < seg; i++) {
        const a = (i / seg) * TAU;
        ring.push(this.p(c[0] + Math.cos(a) * r * sx, c[1] + y * sy, c[2] + Math.sin(a) * r * sz));
      }
      rings.push(ring);
    }
    for (let k = 0; k < rings.length - 1; k++) {
      for (let i = 0; i < seg; i++) {
        const j = (i + 1) % seg;
        this.f([rings[k][i], rings[k][j], rings[k + 1][j], rings[k + 1][i]]);
      }
    }
    if (profile[0][0] > 0.001) this.f(rings[0].slice());
    if (profile[profile.length - 1][0] > 0.001) this.f(rings[rings.length - 1].slice());
    return this;
  }

  ellipsoid(c: V3, rx: number, ry: number, rz: number, seg = 10, rings = 6): this {
    const prof: Array<[number, number]> = [];
    for (let j = 0; j <= rings; j++) { const ph = (j / rings) * Math.PI; prof.push([Math.sin(ph), -Math.cos(ph)]); }
    return this.lathe(prof, seg, c, rx, rz, ry);
  }

  box(c: V3, hx: number, hy: number, hz: number): this {
    const [x, y, z] = c;
    const v = [
      this.p(x - hx, y - hy, z - hz), this.p(x + hx, y - hy, z - hz), this.p(x + hx, y + hy, z - hz), this.p(x - hx, y + hy, z - hz),
      this.p(x - hx, y - hy, z + hz), this.p(x + hx, y - hy, z + hz), this.p(x + hx, y + hy, z + hz), this.p(x - hx, y + hy, z + hz),
    ];
    for (const q of [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [3, 2, 6, 7], [0, 3, 7, 4], [1, 2, 6, 5]]) this.f(q.map(i => v[i]));
    return this;
  }

  /** A round rod from a to b, thicker or thinner at the far end. */
  tube(a: V3, b: V3, r0: number, r1 = r0, seg = 6): this {
    const d: V3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const len = Math.hypot(d[0], d[1], d[2]) || 1;
    d[0] /= len; d[1] /= len; d[2] /= len;
    const h: V3 = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    let u: V3 = [d[1] * h[2] - d[2] * h[1], d[2] * h[0] - d[0] * h[2], d[0] * h[1] - d[1] * h[0]];
    const ul = Math.hypot(u[0], u[1], u[2]) || 1;
    u = [u[0] / ul, u[1] / ul, u[2] / ul];
    const v: V3 = [d[1] * u[2] - d[2] * u[1], d[2] * u[0] - d[0] * u[2], d[0] * u[1] - d[1] * u[0]];
    const ring = (o: V3, r: number): number[] => {
      const out: number[] = [];
      for (let i = 0; i < seg; i++) {
        const t = (i / seg) * TAU, cs = Math.cos(t) * r, sn = Math.sin(t) * r;
        out.push(this.p(o[0] + u[0] * cs + v[0] * sn, o[1] + u[1] * cs + v[1] * sn, o[2] + u[2] * cs + v[2] * sn));
      }
      return out;
    };
    const A = ring(a, r0), B = ring(b, r1);
    for (let i = 0; i < seg; i++) { const j = (i + 1) % seg; this.f([A[i], A[j], B[j], B[i]]); }
    this.f(A.slice()); this.f(B.slice());
    return this;
  }

  /** A bent rod in the plane facing the viewer: handles, wheels, the bow of a key. */
  arcXY(cx: number, cy: number, z: number, radius: number, a0: number, a1: number, r: number, steps = 8): this {
    let last: V3 | null = null;
    for (let i = 0; i <= steps; i++) {
      const a = a0 + ((a1 - a0) * i) / steps;
      const q: V3 = [cx + Math.cos(a) * radius, cy + Math.sin(a) * radius, z];
      if (last) this.tube(last, q, r, r, 5);
      last = q;
    }
    return this;
  }

  /** A flat shape from the side, given thickness: boots, chair backs. */
  slab(poly: Array<[number, number]>, z0: number, z1: number): this {
    const a = poly.map(([x, y]) => this.p(x, y, z0));
    const b = poly.map(([x, y]) => this.p(x, y, z1));
    this.f(a.slice()); this.f(b.slice());
    for (let i = 0; i < poly.length; i++) { const j = (i + 1) % poly.length; this.f([a[i], a[j], b[j], b[i]]); }
    return this;
  }

  build(id: string, name: string, nameNl: string, line: string, lineNl: string, colour: string): ObjectModel {
    // nothing may be bigger than the turntable: scale down, never up, so a model's own proportions stay as drawn
    let m = 0;
    for (const p of this.pts) m = Math.max(m, Math.hypot(p[0], p[1], p[2]));
    const k = m > 1.12 ? 1.12 / m : 1;
    const pts = this.pts.map(p => [p[0] * k, p[1] * k, p[2] * k] as V3);
    return { id, name, nameNl, line, lineNl, colour, pts, faces: this.faces, faceColour: this.cols };
  }
}

function teapot(): ObjectModel {
  const m = new Mesh('#e07a5f');
  m.lathe([[0, -0.55], [0.45, -0.55], [0.7, -0.3], [0.78, 0.05], [0.62, 0.4], [0.35, 0.5], [0, 0.5]], 14);
  m.paint('#c9573c').lathe([[0.36, 0.5], [0.3, 0.58], [0.1, 0.64], [0.07, 0.76], [0, 0.82]], 10);
  m.paint('#e07a5f').tube([0.6, -0.12, 0], [1.0, 0.42, 0], 0.13, 0.07);
  m.arcXY(-0.78, 0.06, 0, 0.34, Math.PI / 2, (3 * Math.PI) / 2, 0.08, 8);
  return m.build('teapot', 'a teapot', 'een theepot', 'A teapot.', 'Een theepot.', '#e07a5f');
}

function chair(): ObjectModel {
  const m = new Mesh('#c58a4a');
  m.box([0, -0.12, 0], 0.55, 0.07, 0.55);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) m.box([sx * 0.47, -0.58, sz * 0.47], 0.065, 0.42, 0.065);
  for (const sx of [-1, 1]) m.box([sx * 0.47, 0.42, -0.47], 0.065, 0.52, 0.065);
  m.paint('#a8703a').box([0, 0.86, -0.47], 0.5, 0.1, 0.05);
  m.box([0, 0.5, -0.47], 0.42, 0.045, 0.04);
  m.box([0, 0.2, -0.47], 0.42, 0.045, 0.04);
  return m.build('chair', 'a chair', 'een stoel', 'A chair.', 'Een stoel.', '#c58a4a');
}

function duck(): ObjectModel {
  const m = new Mesh('#f6c945');
  m.ellipsoid([-0.05, -0.45, 0], 0.8, 0.5, 0.55, 12, 7);
  m.ellipsoid([0.5, 0.3, 0], 0.34, 0.34, 0.34, 10, 6);
  m.tube([-0.7, -0.4, 0], [-1.0, -0.05, 0], 0.22, 0.05, 6);
  m.paint('#f08a24').box([0.92, 0.24, 0], 0.22, 0.05, 0.16);
  m.paint('#2a2a3a').ellipsoid([0.66, 0.42, 0.26], 0.05, 0.05, 0.05, 6, 4);
  m.paint('#e8b230').ellipsoid([-0.1, -0.35, 0.5], 0.4, 0.22, 0.1, 8, 5);
  return m.build('duck', 'a duck', 'een eend', 'A duck.', 'Een eend.', '#f6c945');
}

function mug(): ObjectModel {
  const m = new Mesh('#4aa3c7');
  m.lathe([[0, -0.7], [0.55, -0.7], [0.58, -0.65], [0.58, 0.65], [0.5, 0.7], [0, 0.7]], 14, [-0.12, 0, 0]);
  m.paint('#3a8aab').arcXY(0.52, 0.0, 0, 0.4, -Math.PI / 2, Math.PI / 2, 0.09, 8);
  return m.build('mug', 'a mug', 'een mok', 'A mug.', 'Een mok.', '#4aa3c7');
}

function boot(): ObjectModel {
  const m = new Mesh('#d9534f');
  m.slab([[-0.5, 0.95], [0.05, 0.95], [0.08, -0.05], [0.5, -0.2], [0.88, -0.35], [0.92, -0.72], [-0.5, -0.72]], -0.32, 0.32);
  m.paint('#5a3a2a').slab([[-0.5, -0.72], [0.92, -0.72], [0.96, -0.92], [-0.5, -0.92]], -0.36, 0.36);
  m.paint('#b94440').box([-0.52, 0.95, 0], 0.08, 0.08, 0.36);
  return m.build('boot', 'a boot', 'een laars', 'A boot.', 'Een laars.', '#d9534f');
}

function key(): ObjectModel {
  const m = new Mesh('#d6b040');
  m.arcXY(0, 0.55, 0, 0.33, 0, TAU, 0.11, 12);
  m.tube([0, 0.22, 0], [0, -0.98, 0], 0.1, 0.1, 6);
  m.paint('#b8932e').box([0.2, -0.62, 0], 0.15, 0.08, 0.09);
  m.box([0.15, -0.88, 0], 0.1, 0.08, 0.09);
  return m.build('key', 'a key', 'een sleutel', 'A key.', 'Een sleutel.', '#d6b040');
}

function bicycle(): ObjectModel {
  const m = new Mesh('#3d8fd1');
  const R = 0.42, cy = -0.56;
  m.paint('#2a2f3a').arcXY(-0.6, cy, 0, R, 0, TAU, 0.07, 14);
  m.arcXY(0.6, cy, 0, R, 0, TAU, 0.07, 14);
  m.paint('#3d8fd1');
  const rear: V3 = [-0.6, cy, 0], front: V3 = [0.6, cy, 0], seat: V3 = [-0.22, 0.2, 0], crank: V3 = [0.0, cy, 0], head: V3 = [0.4, 0.22, 0];
  m.tube(rear, seat, 0.05); m.tube(rear, crank, 0.05); m.tube(seat, crank, 0.05);
  m.tube(seat, head, 0.05); m.tube(crank, head, 0.05); m.tube(head, front, 0.05);
  m.tube(head, [0.46, 0.55, 0], 0.05);
  m.paint('#2a2f3a').tube([0.46, 0.55, -0.3], [0.46, 0.55, 0.3], 0.05);
  m.box([-0.28, 0.3, 0], 0.17, 0.05, 0.08);
  m.tube([-0.22, 0.2, 0], [-0.26, 0.3, 0], 0.04);
  return m.build('bicycle', 'a bicycle', 'een fiets', 'A bicycle.', 'Een fiets.', '#3d8fd1');
}

function teddy(): ObjectModel {
  const m = new Mesh('#b9824f');
  m.ellipsoid([0, -0.28, 0], 0.5, 0.55, 0.42, 10, 6);
  m.ellipsoid([0, 0.52, 0], 0.38, 0.36, 0.36, 10, 6);
  for (const s of [-1, 1]) {
    m.ellipsoid([s * 0.27, 0.82, 0], 0.15, 0.15, 0.1, 6, 4);
    m.tube([s * 0.4, 0.0, 0], [s * 0.78, -0.3, 0.06], 0.16, 0.13, 6);
    m.ellipsoid([s * 0.28, -0.8, 0.14], 0.23, 0.2, 0.26, 8, 5);
  }
  m.paint('#e6c9a0').ellipsoid([0, 0.42, 0.34], 0.17, 0.14, 0.12, 8, 5);
  m.paint('#3a2a22').ellipsoid([0, 0.47, 0.45], 0.06, 0.045, 0.04, 6, 4);
  return m.build('teddy', 'a teddy bear', 'een teddybeer', 'A teddy bear.', 'Een teddybeer.', '#b9824f');
}

function can(): ObjectModel {
  const m = new Mesh('#4fae8a');
  m.lathe([[0, -0.7], [0.5, -0.7], [0.52, -0.62], [0.52, 0.3], [0.44, 0.38], [0, 0.38]], 14, [-0.1, 0, 0]);
  m.paint('#3b8f70').tube([0.4, -0.35, 0], [0.98, 0.5, 0], 0.09, 0.07);
  m.tube([0.98, 0.5, 0], [1.06, 0.62, 0], 0.17, 0.2, 8);
  m.arcXY(-0.1, 0.38, 0, 0.42, 0.05, Math.PI - 0.05, 0.06, 8);
  m.arcXY(-0.62, -0.1, 0, 0.3, Math.PI / 2, (3 * Math.PI) / 2, 0.06, 8);
  return m.build('can', 'a watering can', 'een gieter', 'A watering can.', 'Een gieter.', '#4fae8a');
}

/** The nine things on the turntable, in the order the levels draw from. */
export const OBJECTS: ObjectModel[] = [teapot(), chair(), duck(), mug(), boot(), key(), bicycle(), teddy(), can()];
export const objectById = (id: string): ObjectModel => OBJECTS.find(o => o.id === id) ?? OBJECTS[0];

// ---------------------------------------------------------------- geometry

/**
 * Turn a point: first about the vertical axis (the turntable), then tip the whole thing about the
 * axis that runs along the wall. Turning right (a positive yaw) brings the front towards the right of
 * the screen; a positive pitch tips the top towards the wall.
 */
export function rotate(p: V3, yaw: number, pitch: number): V3 {
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const x1 = p[0] * cy + p[2] * sy, z1 = -p[0] * sy + p[2] * cy, y1 = p[1];
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  return [x1 * cp + y1 * sp, -x1 * sp + y1 * cp, z1];
}

/**
 * The shadow of a model on the wall: each point is thrown from the lamp through itself onto the
 * plane x = wall.x. Wall x is the depth axis (z) seen from the lamp, wall y is height.
 * Every polygon comes back wound the same way, so they can be filled together without cancelling.
 */
export function project(model: ObjectModel, yaw: number, pitch: number, lamp: Lamp = LAMP, wall: Wall = WALL): Shadow {
  const sp: P2[] = model.pts.map(p => {
    const r = rotate(p, yaw, pitch);
    const dx = Math.max(0.05, r[0] - lamp.x);
    const t = (wall.x - lamp.x) / dx;
    return { x: lamp.z + t * (r[2] - lamp.z), y: lamp.y + t * (r[1] - lamp.y) };
  });
  return model.faces.map(f => {
    const poly = f.map(i => sp[i]);
    let a = 0;
    for (let i = 0; i < poly.length; i++) { const q = poly[(i + 1) % poly.length]; a += poly[i].x * q.y - q.x * poly[i].y; }
    return a < 0 ? poly.reverse() : poly;
  });
}

/** Mirror a shadow left to right, the way the second level's target relates to what you first see. */
export const mirror = (s: Shadow): Shadow => s.map(poly => poly.map(p => ({ x: -p.x, y: p.y })).reverse());

/** Fill a mask: a cell is in when its centre is inside any polygon. */
export function rasterise(s: Shadow, grid = GRID): Uint8Array {
  const mask = new Uint8Array(grid * grid);
  const cell = (2 * WALL_R) / grid;
  for (const poly of s) {
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const p of poly) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
    const i0 = Math.max(0, Math.floor((x0 + WALL_R) / cell - 0.5)), i1 = Math.min(grid - 1, Math.ceil((x1 + WALL_R) / cell - 0.5));
    const j0 = Math.max(0, Math.floor((WALL_R - y1) / cell - 0.5)), j1 = Math.min(grid - 1, Math.ceil((WALL_R - y0) / cell - 0.5));
    for (let j = j0; j <= j1; j++) {
      const py = WALL_R - (j + 0.5) * cell;
      for (let i = i0; i <= i1; i++) {
        if (mask[j * grid + i]) continue;
        const px = -WALL_R + (i + 0.5) * cell;
        let inside = false;
        for (let a = 0, b = poly.length - 1; a < poly.length; b = a++) {
          const pa = poly[a], pb = poly[b];
          if ((pa.y > py) !== (pb.y > py) && px < ((pb.x - pa.x) * (py - pa.y)) / (pb.y - pa.y) + pa.x) inside = !inside;
        }
        if (inside) mask[j * grid + i] = 1;
      }
    }
  }
  return mask;
}

function grow(mask: Uint8Array, grid: number): Uint8Array {
  const out = new Uint8Array(mask.length);
  for (let j = 0; j < grid; j++) for (let i = 0; i < grid; i++) {
    if (!mask[j * grid + i]) continue;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const a = i + di, b = j + dj;
      if (a >= 0 && b >= 0 && a < grid && b < grid) out[b * grid + a] = 1;
    }
  }
  return out;
}

/**
 * How well a shadow fits the target, 0 (nothing in common) to 1 (the same shape).
 *
 * Both masks are first thickened by one cell and then compared by overlap over union. The
 * thickening is the forgiveness: a thin bicycle or key would otherwise be lost by a hair's turn,
 * while a fat teapot is hardly changed by it.
 */
export function matchScore(a: Shadow, b: Shadow): number {
  const A = rasterise(a), B = rasterise(b);
  let any = 0, anyB = 0;
  for (let i = 0; i < A.length; i++) { any += A[i]; anyB += B[i]; }
  if (any === 0 || anyB === 0) return 0;
  const Ad = grow(A, GRID), Bd = grow(B, GRID);
  let inter = 0, uni = 0;
  for (let i = 0; i < A.length; i++) { inter += Ad[i] & Bd[i]; uni += Ad[i] | Bd[i]; }
  return inter / uni;
}

// ---------------------------------------------------------------- levels

export interface Level {
  id: number;
  name: string;
  nameNl: string;
  /** one line for the card; the child hears LINE_INSTRUCTION */
  line: string;
  lineNl: string;
  count: number;
  /** the target is the mirror image of what stands there, so it has to be turned right round */
  mirror: boolean;
  /** the object can also be tipped */
  tilt: boolean;
  /** the score at which it fits; a product decision, a little more forgiving when there are two ways to turn */
  threshold: number;
}

export const LEVELS: Level[] = [
  { id: 1, name: 'Turn', nameNl: 'Draaien', line: 'Turn it until the shadow fits.', lineNl: 'Draai tot de schaduw past.', count: 8, mirror: false, tilt: false, threshold: 0.84 },
  { id: 2, name: 'Round', nameNl: 'Omdraaien', line: 'The shadow is a mirror image. Turn it right round.', lineNl: 'De schaduw is gespiegeld. Draai hem helemaal om.', count: 8, mirror: true, tilt: false, threshold: 0.84 },
  { id: 3, name: 'Tip', nameNl: 'Kantelen', line: 'Turn it and tip it.', lineNl: 'Draai hem en kantel hem.', count: 8, mirror: false, tilt: true, threshold: 0.8 },
];

/** For a child of two or three: five things, only turning, a lower bar, and no stars (src/platform/who.ts). */
export const SIMPLE_LEVEL: Level = { id: 0, name: 'Turn', nameNl: 'Draaien', line: 'Turn it until the shadow fits.', lineNl: 'Draai tot de schaduw past.', count: 5, mirror: false, tilt: false, threshold: 0.78 };

export const LINE_INSTRUCTION = { en: 'Turn the thing until the shadow fits.', nl: 'Draai het ding tot de schaduw past.' };
export const LINE_YES = { en: 'Yes, that fits.', nl: 'Ja, zo past hij.' };

/** Seconds without a fit before the arrow shows, and again before the second hint. Product decision. */
export const HINT_AFTER = 10;
/** An object counts as "without help" when it needed fewer than this many hints. */
export const CLEAN_BELOW = 2;
/** The shadow must fit for this long before it is accepted, so a swipe straight through does not count. Product decision. */
export const DWELL = 0.4;
/** How far a pitch can tip either way, in radians. */
export const PITCH_MAX = 1.0;

export const rngFor = (level: Level, attempt: number): (() => void) & (() => number) =>
  makeRng(level.id * 7919 + attempt * 104729) as (() => void) & (() => number);

/** The things of one round: `count` different objects in a shuffled order. */
export function objectsFor(level: Level, rng: () => number): string[] {
  const ids = OBJECTS.map(o => o.id);
  for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
  return ids.slice(0, Math.min(level.count, ids.length));
}

export interface Round { id: string; yaw0: number; pitch0: number; yawT: number; pitchT: number; threshold: number }

/** The angle from a to b, the short way round, in (-PI, PI]. */
export function angleDiff(a: number, b: number): number {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d <= -Math.PI) d += TAU;
  return d;
}

/** How much room the fit leaves: the best a turn of `step` radians away still scores. */
function neighbour(model: ObjectModel, yaw: number, pitch: number, tilt: boolean, step: number): number {
  const t = project(model, yaw, pitch);
  let worst = 0;
  const probe = (y: number, p: number): void => { worst = Math.max(worst, matchScore(project(model, y, p), t)); };
  probe(yaw + step, pitch); probe(yaw - step, pitch);
  if (tilt) { probe(yaw, pitch + step); probe(yaw, pitch - step); }
  return worst;
}

/** How far off, in radians, the child may be and still fit. A product decision, same for every object. */
export const FIT_ARC = 0.3;
/** The threshold never falls below this much under the level's. */
export const THRESHOLD_ROOM = 0.12;

/**
 * Pick where the target stands and where the object starts.
 *
 * Round things (a mug, a teapot seen end on) hardly change their shadow when turned, so a fixed
 * score would let the child "fit" them from half a turn away. So the target is picked where the
 * shadow changes most, and its threshold is set just above what a turn of FIT_ARC away scores,
 * within THRESHOLD_ROOM of the level's. The start is never already a fit.
 */
export function makeRound(id: string, level: Level, rng: () => number): Round {
  const model = objectById(id);
  let best: Round | null = null, bestKey = -Infinity;
  for (let n = 0; n < 24; n++) {
    const yawT = rng() * TAU;
    const pitchT = level.tilt ? (rng() < 0.5 ? -1 : 1) * (0.35 + 0.35 * rng()) : 0;
    const yaw0 = level.mirror ? yawT + Math.PI + (rng() - 0.5) * 0.5 : yawT + (rng() < 0.5 ? -1 : 1) * (1.0 + 1.8 * rng());
    const near = neighbour(model, yawT, pitchT, level.tilt, FIT_ARC);
    const threshold = Math.min(level.threshold, Math.max(level.threshold - THRESHOLD_ROOM, near + 0.03));
    const start = matchScore(project(model, yaw0, 0), project(model, yawT, pitchT));
    // a good round: a sharp target, and a start that is clearly not it
    const key = (start < threshold - 0.08 ? 1 : 0) * 10 - near - start * 0.5;
    if (key > bestKey) { bestKey = key; best = { id, yaw0, pitch0: 0, yawT, pitchT, threshold }; }
    if (near + 0.03 < level.threshold - 0.02 && start < threshold - 0.12) return { id, yaw0, pitch0: 0, yawT, pitchT, threshold };
  }
  // A near-symmetrical thing can still start as a fit when it is mirrored (a teapot seen end on).
  // Then the start is walked round, a little at a time, until it clearly is not one.
  // Walking in one direction was not enough for a teapot: its shadow fits at almost every yaw. So
  // the whole circle is tried and the start that fits least is taken, whatever it scores.
  const r = best as Round;
  const target = project(model, r.yawT, r.pitchT);
  let lowYaw = r.yaw0, low = matchScore(project(model, r.yaw0, r.pitch0), target);
  for (let k = 1; k <= 36 && low >= r.threshold - 0.08; k++) {
    const yaw = r.yaw0 + k * (TAU / 36);
    const sc = matchScore(project(model, yaw, r.pitch0), target);
    if (sc < low) { low = sc; lowYaw = yaw; }
  }
  r.yaw0 = lowYaw;
  return r;
}

export type Way = 'left' | 'right' | 'up' | 'down';

/**
 * Which way to drag, for the hint arrow. The turn comes first, since nothing else fits until it is
 * about right; then the tip. 'right' means: drag right, which turns the front to the right.
 */
export function hintDirection(yaw: number, pitch: number, r: Round, tilt: boolean): Way | null {
  const dy = angleDiff(yaw, r.yawT);
  if (Math.abs(dy) > 0.3) return dy > 0 ? 'right' : 'left';
  if (tilt) {
    const dp = r.pitchT - pitch;
    if (Math.abs(dp) > 0.2) return dp > 0 ? 'down' : 'up';
  }
  if (Math.abs(dy) > 0.04) return dy > 0 ? 'right' : 'left';
  return null;
}

/**
 * Stars for a level: how many of the objects fitted with fewer than CLEAN_BELOW hints. Finishing is
 * always one star, because nothing here can be failed; seven of eight is three. Product decision.
 */
export function starsFor(clean: number, total: number): number {
  if (clean >= total - 1) return 3;
  if (clean >= Math.ceil(total / 2)) return 2;
  return 1;
}

/** How many hints an object has had after `secs` seconds without a fit. */
export const hintsAfter = (secs: number): number => Math.floor(Math.max(0, secs) / HINT_AFTER);
