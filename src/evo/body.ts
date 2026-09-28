/**
 * One body that can become every body on our side of the family tree, from a finger-long fish to
 * you.
 *
 * The owner asked for evolution with transformations: not a row of pictures but one animal turning
 * into the next under the child's finger. A row of pictures can only say "and then there was this";
 * a body that changes shape while you watch says what evolution actually is - the same parts,
 * a little different each time, over and over. So every animal here is the same set of numbers
 * (how upright, how long the tail, how big the braincase, fin or fingers, scales or fur) and the
 * drawing is made from the numbers. Halfway between two animals is simply halfway between their
 * numbers, and the drawing in between is always a whole, believable animal.
 *
 * The bones are drawn from the same skeleton that places the flesh, which is what makes the X-ray
 * honest: the upper bone of a fin, a leg and an arm is one bone in one colour, and so are the two
 * bones below it and the little bones at the end. Seeing the same three colours come through from
 * Tiktaalik's fin to a person's arm is the single best evidence a child can see with their eyes.
 *
 * Units: the trunk (hip joint to shoulder joint) is 1, everything else is a share of it. A person's
 * trunk is about half a metre, so their legs are 1.75 and their arms 1.2. `(x, y)` is the point on
 * the ground under the hip and `s` is pixels per trunk. The animal faces right unless told not to.
 */

type Ctx = CanvasRenderingContext2D;
type P = [number, number];
const TAU = Math.PI * 2;

export interface Body {
  /** 0 lying or swimming level, 1 standing straight up on two legs */
  posture: number;
  /** half the depth of the trunk, as a share of its length */
  girth: number;
  /** buttocks, chest and belly: the bulges that make an upright body a person and not a tube */
  butt: number;
  chest: number;
  belly: number;
  /** tail length, and how much of a fin it has on it */
  tail: number;
  tailFin: number;
  dorsalFin: number;
  neck: number;
  /** head length, and its height as a share of that length */
  head: number;
  headH: number;
  /** how far the face sticks out: 1 a long snout, 0 a flat face */
  snout: number;
  /** how high the braincase rises: the brain getting bigger */
  dome: number;
  brow: number;
  chin: number;
  /** a nose that sticks out, which only our own genus has */
  nose: number;
  /** 0 a round mouth with no jaw, 1 a hinged jaw */
  jaw: number;
  eye: number;
  /** 0 eyes on the side of the head, 1 both looking forward */
  eyeFront: number;
  /** the white of the eye, which people show and apes mostly do not */
  sclera: number;
  ear: number;
  whisker: number;
  /** limb lengths, 0 for none: shoulder to wrist, hip to ankle */
  arm: number;
  leg: number;
  /** 0 fingers and toes, 1 a fin */
  fin: number;
  digits: number;
  /** 0 legs straight under the body, 1 sticking out sideways like a lizard's */
  sprawl: number;
  /** a big toe and thumb that can grip */
  grasp: number;
  /** walking on the knuckles, the way apes put their hands down */
  knuckle: number;
  skin: string;
  under: string;
  fur: number;
  furCol: string;
  hair: number;
  hairCol: string;
  scales: number;
  /** 0 a rod down the back (notochord), 1 a spine of bones */
  vert: number;
  ribs: number;
  /** how see-through: the first small swimmers */
  clear: number;
  /** 1 swims, 0 walks */
  swim: number;
  /** a hide worn round the hips */
  wrap: number;
}

export interface Pose {
  t: number;
  /** strides or strokes so far */
  phase: number;
  /** 0 flesh .. 1 bones */
  xray: number;
  facing: -1 | 1;
  /** a part to pick out: the arm bones, the fingers, the tail, the brain */
  show?: 'arm' | 'digits' | 'tail' | 'brain' | 'jaw' | 'spine' | null;
  /** 0 still, 1 moving */
  move: number;
  /** 0 shut .. 1 open */
  bite?: number;
  /** a sniff: the head dipping and the whiskers going */
  sniff?: number;
}

// ---------------------------------------------------------------- mixing two bodies

export function mixHex(a: string, b: string, k: number): string {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (s: number): number => Math.round(((pa >> s) & 255) * (1 - k) + ((pb >> s) & 255) * k);
  return '#' + ((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0');
}

/** Halfway between two animals is halfway between their numbers. */
export function mixBody(a: Body, b: Body, k: number): Body {
  const out = { ...a } as Record<string, number | string>;
  for (const key of Object.keys(a) as Array<keyof Body>) {
    const va = a[key], vb = b[key];
    out[key] = typeof va === 'number' ? va + ((vb as number) - va) * k : mixHex(va as string, vb as string, k);
  }
  return out as unknown as Body;
}

export const smooth = (k: number): number => k * k * (3 - 2 * k);
const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
const mix = (a: number, b: number, k: number): number => a + (b - a) * k;

export function shade(hex: string, k: number): string {
  const v = parseInt(hex.slice(1), 16);
  const f = (x: number): number => Math.round(k >= 0 ? x + (255 - x) * k : x * (1 + k));
  return `rgb(${f((v >> 16) & 255)},${f((v >> 8) & 255)},${f(v & 255)})`;
}

function hash(i: number, seed: number): number {
  const a = Math.sin((i + seed) * 12.9898) * 43758.5453;
  return a - Math.floor(a);
}

/** A smooth closed curve through points (Catmull-Rom), which is how every outline here is drawn. */
function smoothPath(pts: P[], closed = true): Path2D {
  const p = new Path2D();
  const n = pts.length;
  const at = (i: number): P => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  p.moveTo(pts[0][0], pts[0][1]);
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    p.bezierCurveTo(
      p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6,
      p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6,
      p2[0], p2[1],
    );
  }
  if (closed) p.closePath();
  return p;
}

// ---------------------------------------------------------------- the skeleton

interface Limb { root: P; joint: P; end: P; tip: P; len: number; far: boolean; front: boolean; stand: number }

export interface Skeleton {
  hip: P;
  sh: P;
  theta: number;
  headAt: P;
  headAng: number;
  L: number;
  H: number;
  ax: number;
  ay: number;
  /** centre line from the tip of the tail to the back of the head, with its depth each side */
  spine: P[];
  dors: number[];
  vent: number[];
  iHip: number;
  iSh: number;
  limbs: Limb[];
  lift: number;
}

/** Where a foot is at a point in its stride: back along the ground, then lifted forward again. */
function stride(root: number, reach: number, lift: number, phase: number): P {
  const p = ((phase % 1) + 1) % 1;
  if (p < 0.6) return [root + reach - (p / 0.6) * 2 * reach, 0];
  const k = (p - 0.6) / 0.4;
  return [root - reach + k * 2 * reach, -Math.sin(k * Math.PI) * lift];
}

/** Where a knee goes between a hip and a foot, bending the way `bend` says. */
function knee(h: P, f: P, a: number, b: number, bend: number): P {
  const dx = f[0] - h[0], dy = f[1] - h[1];
  const d = Math.max(1e-4, Math.min(Math.hypot(dx, dy), a + b - 1e-4));
  const t = Math.atan2(dy, dx);
  const c = Math.acos(Math.max(-1, Math.min(1, (a * a + d * d - b * b) / (2 * a * d))));
  const k = t - bend * c;
  return [h[0] + Math.cos(k) * a, h[1] + Math.sin(k) * a];
}

const bump = (v: number, at: number, w: number): number => Math.exp(-((v - at) * (v - at)) / (w * w));

export function skeleton(b: Body, pose: Pose): Skeleton {
  const ph = pose.phase;
  // how much the body stands on its legs rather than lying on its belly or swimming
  const legged = clamp01((b.leg - 0.18) / 0.25) * clamp01(1 - b.fin * 1.1);
  const swim = b.swim;
  const restH = b.girth * 1.0 + 0.02;
  const floatH = b.girth * 2.2 + 0.3;
  const stand = mix(0.93 - 0.42 * b.sprawl, 0.975, b.posture);
  const hindH = b.leg * stand;
  const foreH = b.arm * (0.93 - 0.42 * b.sprawl) * (1 - 0.1 * b.knuckle);
  const bob = pose.move * Math.abs(Math.sin(ph * TAU)) * 0.015 * legged;
  const hipH = mix(mix(restH, Math.max(restH, hindH), legged), floatH, swim) + bob;
  const shHq = mix(mix(restH, Math.max(restH, foreH), legged), floatH, swim);
  const thetaQ = Math.asin(Math.max(-0.5, Math.min(0.8, shHq - hipH)));
  const up = Math.PI / 2 * 0.975;
  const theta = thetaQ + (up - thetaQ) * b.posture;
  const hip: P = [0, -hipH];
  const sh: P = [hip[0] + Math.cos(theta), hip[1] - Math.sin(theta)];

  // the neck: forward and up from the shoulder on four legs, straight up on two
  const nAng = mix(theta + 0.5 * clamp01(b.neck * 6), up * 1.02, b.posture);
  const neckEnd: P = [sh[0] + Math.cos(nAng) * b.neck, sh[1] - Math.sin(nAng) * b.neck];
  const sniff = pose.sniff ?? 0;
  // the head points forward, level; a fish's in line with its body; a sniff dips it
  const headAng = mix(mix(theta * 0.5, -0.1, 1 - swim), 0.02, b.posture) - sniff * 0.35;
  const L = b.head, H = b.head * b.headH;
  // on four legs the neck meets the back of the skull; standing up it comes in underneath it, as ours
  // does - the hole the spinal cord goes through moved forward as our ancestors stood up
  const ax = mix(mix(0.08, 0.42, swim * clamp01(1 - b.neck * 8)), 0.36, b.posture), ay = mix(mix(0.0, 0.14, 1 - swim), 0.4, b.posture);

  const spine: P[] = [];
  const dors: number[] = [];
  const vent: number[] = [];
  // the tail: back from the hip, drooping on land until it lies along the ground
  const nT = 14;
  const tailA0 = theta + Math.PI;
  const droop = (1 - swim) * 0.7 * (1 - b.posture);
  // a body without a tail still has a bottom: the buttocks round off below the hip, so an upright
  // trunk ends in a curve and not a cut
  const stub = 0;
  const tailLen = Math.max(b.tail, stub);
  const stubK = tailLen > 0 ? stub / tailLen : 0;
  for (let i = nT; i >= 1; i--) {
    const k = i / nT;
    const a = tailA0 + droop * k * 0.9;
    const wave = swim * Math.sin(ph * TAU - k * 4) * 0.03 * k + (1 - swim) * Math.sin(pose.t * 1.3 + k * 2) * 0.02 * k * k;
    const taperTail = swim > 0.5 ? mix(1 - k * 0.55, 1 - k, 1 - swim) : Math.pow(1 - k, mix(0.9, 1.6, b.fur));
    const taperStub = Math.sqrt(Math.max(0, 1 - k * k)) * 0.95;
    const taper = mix(taperTail, taperStub, stubK);
    const r = mix(b.girth * mix(0.72, 0.42, clamp01(b.fur)) * (1 - 0.2 * b.posture), b.girth * 0.72, stubK) * Math.max(0.025, taper);
    // the buttocks sit behind the hip joint, not under it
    let x = hip[0] + Math.cos(a) * tailLen * k - stubK * b.girth * 0.35 * Math.sin(k * Math.PI * 0.8);
    let y = hip[1] - Math.sin(a) * tailLen * k + wave;
    // a tail on land rests on the ground rather than going through it
    if (y > -r) { y = -r; x -= 0.0; }
    spine.push([x, y]);
    dors.push(r);
    vent.push(r * mix(0.92, 0.55, stubK));
  }
  const iHip = spine.length;
  const nB = 12;
  const P2 = b.posture;
  for (let i = 0; i <= nB; i++) {
    const v = i / nB;
    spine.push([hip[0] + (sh[0] - hip[0]) * v, hip[1] + (sh[1] - hip[1]) * v]);
    const g = b.girth;
    let d = g * (0.74 + 0.2 * Math.sin(Math.PI * v));
    // standing up, the back has the curves a spine carrying weight upright has: in at the waist,
    // out at the shoulder blades, and the buttocks behind the hip
    d += b.butt * g * 0.35 * bump(v, 0.1, 0.12);
    d -= P2 * g * 0.12 * bump(v, 0.0, 0.1);
    d -= P2 * g * 0.2 * bump(v, 0.32, 0.14);
    d += P2 * g * 0.1 * bump(v, 0.74, 0.14);
    d -= P2 * g * 0.34 * smooth(clamp01((v - 0.66) / 0.34));
    let vv = g * (0.8 + 0.16 * Math.sin(Math.PI * v));
    vv += b.belly * g * 0.45 * bump(v, 0.36, 0.26) + b.chest * g * 0.35 * bump(v, 0.74, 0.16);
    vv -= P2 * g * 0.1 * bump(v, 0.0, 0.1);
    vv -= P2 * g * 0.3 * smooth(clamp01((v - 0.72) / 0.28));
    dors.push(d);
    vent.push(vv);
  }
  const iSh = spine.length - 1;
  const nN = 6;
  const headR = H * 0.44;
  for (let i = 1; i <= nN; i++) {
    const k = i / nN;
    spine.push([sh[0] + (neckEnd[0] - sh[0]) * k, sh[1] + (neckEnd[1] - sh[1]) * k]);
    const target = b.neck > 0.04 ? Math.min(headR, mix(b.girth * 0.5 + 0.03, b.girth * 0.55, P2)) : headR;
    dors.push(mix(dors[iSh], target, smooth(k)));
    vent.push(mix(vent[iSh], target * 0.95, smooth(k)));
  }

  const limbs: Limb[] = [];
  const upK = clamp01(b.posture * 1.8 - 0.5);
  const fore = (far: boolean): Limb => {
    const len = b.arm;
    const root: P = [sh[0] - Math.cos(theta) * mix(0.06, 0.1, P2) + P2 * 0.01, sh[1] + Math.sin(theta) * mix(0.06, 0.1, P2) + b.girth * 0.25 * (1 - P2)];
    const off = far ? 0.5 : 0;
    const reach = len * 0.3 * pose.move;
    const ground = stride(root[0] + len * 0.05, reach, len * 0.14 * pose.move, ph + off + 0.5);
    const swing = Math.sin((ph + off) * TAU) * 0.3 * pose.move;
    const hang: P = [root[0] + Math.sin(-swing) * len * 0.97 + len * 0.04, root[1] + Math.cos(swing) * len * 0.96];
    const finA = theta + Math.PI * 0.82 + Math.sin((ph + off) * TAU) * 0.25 * (swim + 0.3);
    const finEnd: P = [root[0] + Math.cos(finA) * len, root[1] - Math.sin(finA) * len];
    let end: P = [mix(ground[0], hang[0], upK), mix(ground[1], hang[1], upK)];
    end = [mix(finEnd[0], end[0], legged), mix(finEnd[1], end[1], legged)];
    const joint = knee(root, end, len * 0.52, len * 0.48, -1);
    const handLen = len * mix(0.2, 0.16, P2);
    let tip: P;
    if (upK > 0.5) tip = [end[0] + handLen * 0.2, end[1] + handLen];
    else if (legged > 0.5) tip = [end[0] + handLen * (1 - b.knuckle * 0.7), end[1] - handLen * 0.08 * b.knuckle];
    else tip = [end[0] + (end[0] - joint[0]) * 0.45, end[1] + (end[1] - joint[1]) * 0.45];
    return { root, joint, end, tip, len, far, front: true, stand: legged };
  };
  const hind = (far: boolean): Limb => {
    const len = b.leg;
    const root: P = [hip[0] + Math.cos(theta) * 0.04 + P2 * 0.02, hip[1] - Math.sin(theta) * mix(0.04, 0.13, P2) + b.girth * 0.3 * (1 - P2) + 0.02 * (1 - P2)];
    const off = far ? 0.5 : 0;
    const reach = len * mix(0.3, 0.24, P2) * pose.move;
    const ground = stride(root[0] + len * mix(0.05, 0.02, P2), reach, len * 0.12 * pose.move, ph + off);
    const finA = theta + Math.PI * 0.9 + Math.sin((ph + off) * TAU) * 0.2;
    const finEnd: P = [root[0] + Math.cos(finA) * len, root[1] - Math.sin(finA) * len];
    const end: P = [mix(finEnd[0], ground[0], legged), mix(finEnd[1], ground[1], legged)];
    const joint = knee(root, end, len * 0.52, len * 0.48, 1);
    const footLen = len * mix(0.32, 0.17, P2);
    const tip: P = legged > 0.5
      ? [end[0] + footLen, Math.min(0, end[1] + 0.01)]
      : [end[0] + (end[0] - joint[0]) * 0.4, end[1] + (end[1] - joint[1]) * 0.4];
    return { root, joint, end, tip, len, far, front: false, stand: legged };
  };
  if (b.arm > 0.02) { limbs.push(fore(true)); limbs.push(fore(false)); }
  if (b.leg > 0.02) { limbs.push(hind(true)); limbs.push(hind(false)); }

  return { hip, sh, theta, headAt: neckEnd, headAng, L, H, ax, ay, spine, dors, vent, iHip, iSh, limbs, lift: hipH };
}

/** A point given in the head's own frame (x 0..1 back to front, y down in head heights) in body units. */
function headPoint(sk: Skeleton, q: P): P {
  const x = (q[0] - sk.ax) * sk.L, y = (q[1] - sk.ay) * sk.H;
  const c = Math.cos(sk.headAng), s = Math.sin(sk.headAng);
  return [sk.headAt[0] + x * c + y * s, sk.headAt[1] - x * s + y * c];
}

/** How far the animal reaches in each direction from the point under its hip, for fitting it on screen. */
export function extent(b: Body): { left: number; right: number; top: number } {
  const sk = skeleton(b, { t: 0, phase: 0, xray: 0, facing: 1, move: 0 });
  let left = 0, right = 0, top = 0;
  const see = (p: P): void => { left = Math.min(left, p[0]); right = Math.max(right, p[0]); top = Math.min(top, p[1]); };
  sk.spine.forEach((p, i) => { see([p[0], p[1] - sk.dors[i]]); });
  const hd = headLandmarks(b);
  for (const q of hd.pts) see(headPoint(sk, q));
  for (const l of sk.limbs) { see(l.end); see(l.tip); see(l.joint); }
  return { left: left - b.tailFin * 0.3, right: right + b.whisker * 0.05, top: top - b.dorsalFin * 0.12 - b.hair * 0.06 * b.head };
}

// ---------------------------------------------------------------- the head

interface HeadLand {
  pts: P[];
  face: number;
  brow: number;
  top: number;
  eye: P;
  ear: P;
  mouth: P;
  lip: P;
  nose: P;
  jaw: P[];
}

/**
 * The profile of the head as landmarks: the back of the skull, the crown, the forehead, the brow,
 * the bridge of the nose, the snout or nose, the lips, the chin and the jaw. A fish, a lizard, a
 * shrew, a chimpanzee and a person are all these same points in different places, which is also
 * true of their skulls.
 */
function headLandmarks(b: Body): HeadLand {
  const s = b.snout, dome = b.dome;
  const face = mix(0.9, 1.0, s);
  const brow = face - mix(0.06, 0.44, s);
  const top = -0.5 - dome * 0.28;
  const jawK = b.jaw;
  const sw = b.swim * (1 - b.posture);
  // lips, a chin and a nose that sticks out belong to the primates and most of all to us; on a snout
  // these points fold back onto the plain line of the jaw
  const lk = clamp01((b.eyeFront - 0.5) * 2) * clamp01(1 - s * 1.6);
  const pts: P[] = [
    [0.0 + 0.12 * sw, 0.06],                                  // the back of the skull
    [0.05 + 0.1 * sw, top * mix(0.62, 0.45, sw)],
    [0.22, top * 0.97],
    [0.4, top],                                               // the crown
    [brow - 0.06 + 0.04 * dome, top * mix(0.82, 0.7, dome)],  // the forehead
    [brow + 0.02 + b.brow * 0.035, -0.2 + 0.08 * s],          // the brow
    [brow + 0.03 - 0.01 * lk, -0.1 + 0.07 * s],               // the bridge of the nose
    [mix(brow + 0.05, face - 0.05, s) + b.nose * 0.03, mix(-0.02, -0.06, s)], // down the nose or the snout
    [face + b.nose * 0.13, mix(0.08, 0.0, s)],                // the tip of the nose or snout
    [face + b.nose * 0.06, mix(0.14, 0.08, s)],               // under the tip
    [face - 0.012 * lk, mix(0.17, 0.12, s)],                  // where the nose meets the lip
    [face + 0.014 * lk, mix(0.23, 0.18, s)],                  // the upper lip
    [face - 0.012 * lk, mix(0.27, 0.22, s)],                  // between the lips
    [face + 0.004 * lk - (1 - b.chin) * 0.02, mix(0.31, 0.26, s)], // the lower lip
    [face - 0.035 * lk - (1 - b.chin) * 0.03, mix(0.37, 0.32, s)], // the fold under the lip
    [face - 0.03 + b.chin * 0.05 - (1 - jawK) * 0.08, mix(0.45, 0.4, s)], // the chin
    [face - 0.09 + b.chin * 0.02, mix(0.51, 0.45, s)],        // under the chin
    [mix(0.5, 0.6, s), mix(0.52, 0.46, s)],                   // under the jaw
    [0.3, 0.45],                                              // the angle of the jaw
    [0.1 + 0.1 * sw, mix(0.34, 0.26, sw)],
  ];
  const eye: P = [brow - mix(0.03, 0.01, s) - 0.04 * (1 - b.eyeFront) * s, mix(-0.08, -0.06, s)];
  return {
    pts, face, brow, top, eye,
    ear: [mix(0.22, 0.4, clamp01(b.posture * 0.9 + lk * 0.6)), mix(-0.3, 0.02, clamp01(b.posture + lk))],
    mouth: [face - mix(0.13, 0.46, s), mix(0.27, 0.22, s)],
    lip: [face - 0.012 * lk - 0.004, mix(0.27, 0.22, s)],
    nose: [face + b.nose * 0.06, mix(0.12, 0.04, s)],
    jaw: [pts[15], pts[16], pts[17], pts[18]],
  };
}

// ---------------------------------------------------------------- drawing pieces

/** The outline of the body from its centre line: along the back, round, and back along the belly. */
function outline(sk: Skeleton): Path2D {
  const top: P[] = [], bot: P[] = [];
  const n = sk.spine.length;
  for (let i = 0; i < n; i++) {
    const a = sk.spine[Math.max(0, i - 1)], c = sk.spine[Math.min(n - 1, i + 1)];
    let dx = c[0] - a[0], dy = c[1] - a[1];
    const d = Math.hypot(dx, dy);
    if (d < 1e-6) { dx = Math.cos(sk.theta); dy = -Math.sin(sk.theta); } else { dx /= d; dy /= d; }
    const nx = dy, ny = -dx;
    top.push([sk.spine[i][0] + nx * sk.dors[i], sk.spine[i][1] + ny * sk.dors[i]]);
    bot.push([sk.spine[i][0] - nx * sk.vent[i], sk.spine[i][1] - ny * sk.vent[i]]);
  }
  // thin out points that sit on top of each other (a tail of length nought) so the curve stays smooth
  const all = [sk.spine[0], ...top, ...bot.reverse()];
  const pts: P[] = [];
  for (const p of all) if (!pts.length || Math.hypot(p[0] - pts[pts.length - 1][0], p[1] - pts[pts.length - 1][1]) > 0.004) pts.push(p);
  return smoothPath(pts);
}

/**
 * A limb as one smooth shape with muscles: a thigh that narrows to the knee and bulges again at the
 * calf, a shoulder, an upper arm, an elbow, a forearm. How much of that shape shows goes with how
 * upright the animal is; a lizard's leg is a plain tapering tube.
 */
function limbPath(l: Limb, b: Body): Path2D {
  const P2 = b.posture;
  const w0 = l.front ? mix(b.girth * 0.6, b.arm * 0.17, P2) : mix(b.girth * 0.78, b.leg * 0.19, P2);
  const prof = (u: number): number => {
    const plain = 1 - u * 0.62;
    const mus = l.front
      ? 0.95 - 0.35 * u + 0.12 * bump(u, 0.22, 0.12) - 0.18 * bump(u, 0.5, 0.06) + 0.06 * bump(u, 0.62, 0.1) - 0.2 * u * u
      : 1 - 0.3 * u - 0.22 * bump(u, 0.5, 0.07) + 0.12 * bump(u, 0.63, 0.1) - 0.38 * u * u;
    return w0 * mix(plain, mus, clamp01(P2 * 1.2 + (1 - b.sprawl) * 0.3)) / 2;
  };
  const chain: P[] = [l.root, l.joint, l.end];
  const samples: Array<{ p: P; n: P; w: number }> = [];
  const N = 16;
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const seg = u < 0.5 ? 0 : 1, k = u < 0.5 ? u * 2 : (u - 0.5) * 2;
    const a = chain[seg], c = chain[seg + 1];
    const p: P = [a[0] + (c[0] - a[0]) * k, a[1] + (c[1] - a[1]) * k];
    // the direction at a joint is the average of the two bones, so the knee rounds instead of kinking
    const d0: P = [chain[1][0] - chain[0][0], chain[1][1] - chain[0][1]];
    const d1: P = [chain[2][0] - chain[1][0], chain[2][1] - chain[1][1]];
    const wj = clamp01((u - 0.4) / 0.2);
    let dx = mix(d0[0] / (Math.hypot(...d0) || 1), d1[0] / (Math.hypot(...d1) || 1), wj);
    let dy = mix(d0[1] / (Math.hypot(...d0) || 1), d1[1] / (Math.hypot(...d1) || 1), wj);
    const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
    samples.push({ p, n: [-dy, dx], w: prof(u) });
  }
  // standing up, the buttock is the back of the top of the thigh
  const butt = !l.front ? b.butt * b.girth * 0.55 * P2 : 0;
  const left = samples.map((s, i) => { const bw = s.w + butt * bump(i / N, 0.07, 0.11); return [s.p[0] + s.n[0] * bw, s.p[1] + s.n[1] * bw] as P; });
  const right = samples.map(s => [s.p[0] - s.n[0] * s.w, s.p[1] - s.n[1] * s.w] as P).reverse();
  return smoothPath([...left, ...right]);
}

/** A hand or a foot: a human foot with a heel and an arch, a paw, a gripping hand, or fingers spread. */
function extremityPath(l: Limb, b: Body): Path2D {
  const P2 = b.posture;
  const wrist = (l.front ? mix(b.girth * 0.6, b.arm * 0.17, P2) : mix(b.girth * 0.78, b.leg * 0.19, P2)) * 0.36 / 2;
  const [ex, ey] = l.end, [tx, ty] = l.tip;
  const dx = tx - ex, dy = ty - ey, len = Math.hypot(dx, dy) || 0.01;
  const ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
  const at = (a: number, c: number): P => [ex + ux * a * len + nx * c, ey + uy * a * len + ny * c];
  if (!l.front && l.stand > 0.5) {
    // a foot flat on the ground: the heel sticks out behind the ankle in people, less in apes
    const heel = mix(0.05, 0.22, P2);
    const h = wrist * 1.3;
    return smoothPath([at(-heel, h * 0.2), at(-heel * 0.8, -h * 0.9), at(0.1, -h * 1.3), at(0.5, -h * 0.9), at(0.85, -h * 0.55),
      at(1.02, -h * 0.25), at(1.0, h * 0.05), at(0.6, h * 0.12), at(0.2, h * 0.1)]);
  }
  const w = wrist * (l.front ? 1.05 : 1.0);
  return smoothPath([at(-0.05, w * 0.9), at(0.35, w * 1.1), at(0.8, w * 0.8), at(1.02, w * 0.25), at(1.0, -w * 0.3),
    at(0.7, -w * 0.9), at(0.3, -w * 1.0), at(-0.05, -w * 0.85)]);
}

/** The three colours that are the same bones in every animal with limbs. */
export const BONE = { upper: '#ffc857', lower: '#5fd4ff', hand: '#ff8fb8', spine: '#f4f1e6', skull: '#efe9d8' };

/** Fur: short soft strokes all along an edge, leaning back, with a haze over them. */
function furAlong(ctx: Ctx, pts: P[], dirs: P[], len: number, colour: string, amount: number, seed: number, lw: number): void {
  if (amount < 0.05) return;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = colour;
  ctx.globalAlpha *= clamp01(amount) * 0.6;
  ctx.lineWidth = lw * 1.1;
  ctx.beginPath();
  for (let i = 0; i < pts.length; i++) {
    const [x, y] = pts[i], [nx, ny] = dirs[i];
    const l = len * (0.5 + hash(i, seed) * 0.9) * amount;
    const lean = 0.9 + (hash(i, seed + 3) - 0.5) * 0.6;
    ctx.moveTo(x - nx * l * 0.4, y - ny * l * 0.4);
    ctx.lineTo(x + nx * l * 0.6 - ny * l * lean * 0.5, y + ny * l * 0.6 + nx * l * lean * 0.5);
  }
  ctx.stroke();
  ctx.restore();
}

function edge(sk: Skeleton, from: number, to: number, side: 1 | -1, step: number): { pts: P[]; dirs: P[] } {
  const pts: P[] = [], dirs: P[] = [];
  const n = sk.spine.length;
  for (let f = from; f < to; f += step) {
    const i = Math.floor(f), k = f - i, j = Math.min(n - 1, i + 1);
    const a = sk.spine[Math.max(0, i - 1)], c = sk.spine[Math.min(n - 1, i + 1)];
    let dx = c[0] - a[0], dy = c[1] - a[1];
    const d = Math.hypot(dx, dy);
    if (d < 1e-6) continue;
    dx /= d; dy /= d;
    const nx = dy * side, ny = -dx * side;
    const cx = sk.spine[i][0] + (sk.spine[j][0] - sk.spine[i][0]) * k, cy = sk.spine[i][1] + (sk.spine[j][1] - sk.spine[i][1]) * k;
    const r = side > 0 ? sk.dors[i] + (sk.dors[j] - sk.dors[i]) * k : sk.vent[i] + (sk.vent[j] - sk.vent[i]) * k;
    pts.push([cx + nx * r, cy + ny * r]);
    dirs.push([nx, ny]);
  }
  return { pts, dirs };
}

function strokeLine(ctx: Ctx, pts: P[], w: number, colour: string): void {
  ctx.strokeStyle = colour; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke();
}

/** Lit from above: lighter on top, darker underneath, across a shape's height. */
function litFill(ctx: Ctx, top: number, bot: number, col: string, under: string, underK: number): CanvasGradient {
  const g = ctx.createLinearGradient(0, top, 0, bot);
  g.addColorStop(0, shade(col, 0.2));
  g.addColorStop(0.45, col);
  g.addColorStop(0.8, mixHex(col, under, underK * 0.6));
  g.addColorStop(1, shade(mixHex(col, under, underK * 0.7), -0.18));
  return g;
}

function drawLimb(ctx: Ctx, l: Limb, b: Body, col: string, dark: boolean, lw: number, fill: CanvasGradient | string, body: Path2D): void {
  const flesh = dark ? mixHex(col, '#000000', 0.3) : col;
  // a fin: a fan from the root, sweeping back
  if (b.fin > 0.02) {
    ctx.save();
    ctx.globalAlpha *= clamp01(b.fin * 1.3);
    const dx = l.tip[0] - l.root[0], dy = l.tip[1] - l.root[1];
    const len = Math.hypot(dx, dy) * 1.2 + 0.04, a = Math.atan2(dy, dx);
    ctx.translate(l.root[0], l.root[1]);
    ctx.rotate(a);
    const gw = len * 0.45;
    const g = ctx.createLinearGradient(0, 0, len, 0);
    g.addColorStop(0, flesh); g.addColorStop(1, dark ? shade(b.skin, -0.2) : shade(b.skin, 0.3));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, -gw * 0.2);
    ctx.quadraticCurveTo(len * 0.55, -gw * 0.75, len, -gw * 0.05);
    ctx.quadraticCurveTo(len * 0.8, gw * 0.45, 0, gw * 0.3);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(25, 30, 20, 0.28)'; ctx.lineWidth = lw * 0.9;
    for (let i = 0; i < 10; i++) {
      const k = i / 9;
      ctx.beginPath(); ctx.moveTo(len * 0.12, 0); ctx.lineTo(len * (0.82 + 0.14 * Math.sin(k * Math.PI)), -gw * 0.65 + k * gw * 0.95); ctx.stroke();
    }
    ctx.restore();
  }
  const limbK = clamp01(1.3 - b.fin * 1.1);
  if (limbK <= 0.01) return;
  ctx.save();
  ctx.globalAlpha *= limbK;
  const lp = limbPath(l, b);
  const ep = extremityPath(l, b);
  if (!dark && b.posture > 0.3) {
    // the arm or leg casts a soft shadow on the body behind it
    ctx.save(); ctx.clip(body); ctx.translate(-0.02, 0.012);
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fill(lp);
    ctx.restore();
  }
  ctx.fillStyle = fill;
  ctx.fill(lp);
  ctx.fill(ep);
  // shade: the far side in shadow, the near side with a soft light down its front edge
  if (dark) { ctx.fillStyle = 'rgba(0,0,0,0.32)'; ctx.fill(lp); ctx.fill(ep); }
  else {
    ctx.save(); ctx.clip(lp);
    const dx = l.end[0] - l.root[0], dy = l.end[1] - l.root[1], d = Math.hypot(dx, dy) || 1;
    const nx = -dy / d, ny = dx / d, w = b.girth * 0.5;
    const hg = ctx.createLinearGradient(l.root[0] + nx * w, l.root[1] + ny * w, l.root[0] - nx * w, l.root[1] - ny * w);
    hg.addColorStop(0, 'rgba(255, 240, 220, 0.07)'); hg.addColorStop(0.5, 'rgba(0,0,0,0)'); hg.addColorStop(1, 'rgba(0,0,0,0.14)');
    ctx.fillStyle = hg; ctx.fillRect(-10, -10, 20, 20);
    // where the leg meets the body it is darker, which is what joins them
    const ao = ctx.createRadialGradient(l.root[0], l.root[1], 0, l.root[0], l.root[1], b.girth * 0.9);
    ao.addColorStop(0, 'rgba(0,0,0,0.0)'); ao.addColorStop(0.6, 'rgba(0,0,0,0.0)'); ao.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = ao; ctx.fillRect(-10, -10, 20, 20);
    ctx.restore();
  }
  // fingers and toes: many on the first four-legged animals, five later, spread on a foot that grips
  const n = Math.round(b.digits);
  if (n > 0 && b.fin < 0.6) {
    const dx = l.tip[0] - l.end[0], dy = l.tip[1] - l.end[1];
    const a = Math.atan2(dy, dx), len = Math.max(0.015, Math.hypot(dx, dy) * mix(0.45, 0.22, b.posture));
    const wr = (l.front ? mix(b.girth * 0.6, b.arm * 0.17, b.posture) : mix(b.girth * 0.78, b.leg * 0.19, b.posture)) * 0.36;
    ctx.strokeStyle = flesh; ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(lw, wr * mix(0.28, 0.22, b.posture));
    const upright = l.front && b.posture > 0.5;
    const flatFoot = !l.front && b.posture > 0.5 && b.grasp < 0.5;
    if (!flatFoot) {
      for (let i = 0; i < n; i++) {
        const spread = (i / Math.max(1, n - 1) - 0.5) * mix(0.55, 1.1, b.sprawl) * (upright ? 0.25 : 1);
        let ga = a + spread;
        if (!l.front && b.grasp > 0.5 && i === 0) ga = a - 0.9;
        ctx.beginPath(); ctx.moveTo(l.tip[0], l.tip[1]); ctx.lineTo(l.tip[0] + Math.cos(ga) * len, l.tip[1] + Math.sin(ga) * len); ctx.stroke();
      }
    }
  }
  // a hanging hand has fingers: four side by side, bending a little towards the palm, and a thumb
  if (l.front && b.posture > 0.5 && b.fin < 0.3) {
    const dx = l.tip[0] - l.end[0], dy = l.tip[1] - l.end[1], len = Math.hypot(dx, dy) || 0.01;
    const ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
    const wr = (l.front ? mix(b.girth * 0.6, b.arm * 0.17, b.posture) : 0) * 0.36;
    const fl = len * 0.5;
    ctx.strokeStyle = dark ? mixHex(col, '#000000', 0.3) : shade(b.skin, 0.02);
    ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const off = (i / 3 - 0.5) * wr * 0.7;
      const bx = l.tip[0] - ux * len * 0.15 + nx * off, by = l.tip[1] - uy * len * 0.15 + ny * off;
      const curl = 0.25 + i * 0.05;
      ctx.lineWidth = wr * 0.26;
      ctx.beginPath(); ctx.moveTo(bx, by);
      ctx.quadraticCurveTo(bx + ux * fl * 0.6, by + uy * fl * 0.6, bx + ux * fl * 0.9 + nx * fl * curl, by + uy * fl * 0.9 + ny * fl * curl);
      ctx.stroke();
    }
    ctx.lineWidth = wr * 0.3;
    const tx = l.end[0] + ux * len * 0.35 + nx * wr * 0.45, ty = l.end[1] + uy * len * 0.35 + ny * wr * 0.45;
    ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx + ux * fl * 0.5 + nx * fl * 0.35, ty + uy * fl * 0.5 + ny * fl * 0.35); ctx.stroke();
  }
  // a knee and a calf, just a touch of light and shade, on legs that stand upright
  if (!l.front && b.posture > 0.5 && !dark) {
    ctx.save(); ctx.clip(lp);
    const kg = ctx.createRadialGradient(l.joint[0] + 0.03, l.joint[1], 0, l.joint[0] + 0.03, l.joint[1], b.leg * 0.08);
    kg.addColorStop(0, `rgba(255, 235, 210, ${0.14 * b.posture})`); kg.addColorStop(1, 'rgba(255, 235, 210, 0)');
    ctx.fillStyle = kg; ctx.fillRect(-5, -5, 10, 10);
    const calf: P = [l.joint[0] + (l.end[0] - l.joint[0]) * 0.3 - 0.04, l.joint[1] + (l.end[1] - l.joint[1]) * 0.3];
    const cg = ctx.createRadialGradient(calf[0], calf[1], 0, calf[0], calf[1], b.leg * 0.12);
    cg.addColorStop(0, `rgba(0, 0, 0, ${0.14 * b.posture})`); cg.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = cg; ctx.fillRect(-5, -5, 10, 10);
    ctx.restore();
  }
  // its outline only where it is outside the body, so the leg grows out of the hip without a seam
  ctx.strokeStyle = 'rgba(15, 10, 5, 0.28)';
  ctx.lineWidth = lw * 1.1;
  ctx.save();
  const o = new Path2D(); o.rect(-20, -20, 40, 40);
  // a leg is outlined only outside the body it grows from; an arm hangs over the body and keeps its line
  if (l.front) o.arc(l.root[0], l.root[1], b.girth * 0.55, 0, TAU); else o.addPath(body);
  ctx.clip(o, 'evenodd');
  ctx.stroke(lp);
  ctx.stroke(ep);
  ctx.restore();
  ctx.restore();
  // fur on a limb: a soft fringe along it
  if (b.fur > 0.1) {
    const pts: P[] = [], dirs: P[] = [];
    for (let i = 0; i < 30; i++) {
      const u = i / 29;
      const seg = u < 0.5 ? 0 : 1, k = u < 0.5 ? u * 2 : (u - 0.5) * 2;
      const c = [l.root, l.joint, l.end];
      const p: P = [c[seg][0] + (c[seg + 1][0] - c[seg][0]) * k, c[seg][1] + (c[seg + 1][1] - c[seg][1]) * k];
      const dx = c[seg + 1][0] - c[seg][0], dy = c[seg + 1][1] - c[seg][1], d = Math.hypot(dx, dy) || 1;
      const w = b.girth * 0.3 * (1 - u * 0.5);
      for (const side of [1, -1]) { pts.push([p[0] - dy / d * w * side, p[1] + dx / d * w * side]); dirs.push([-dy / d * side, dx / d * side]); }
    }
    furAlong(ctx, pts, dirs, 0.016, dark ? shade(b.furCol, -0.4) : shade(b.furCol, -0.15), b.fur * 0.8, 21, lw);
  }
}

// ---------------------------------------------------------------- the whole animal

export function drawBody(ctx: Ctx, x: number, y: number, s: number, b: Body, pose: Pose): void {
  const sk = skeleton(b, pose);
  const hl = headLandmarks(b);
  const hp = (q: P): P => headPoint(sk, q);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s * pose.facing, s);
  const lw = 1 / s;

  // the shadow on the ground, which is what puts an animal on the ground rather than in front of it
  const shadowK = clamp01(1 - (sk.lift - b.girth * 1.1) * 1.2);
  if (shadowK > 0.02) {
    const g = ctx.createRadialGradient(mix(0.45, 0.05, b.posture), 0, 0, mix(0.45, 0.05, b.posture), 0, mix(1.1, 0.5, b.posture));
    g.addColorStop(0, `rgba(0,0,0,${0.32 * shadowK})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.save(); ctx.scale(1, 0.08);
    ctx.beginPath(); ctx.arc(mix(0.45, 0.05, b.posture), 0, mix(1.1, 0.5, b.posture) * (1 + b.tail * 0.3), 0, TAU); ctx.fill();
    ctx.restore();
  }

  const body = outline(sk);
  const headPts = hl.pts.map(hp);
  const head = smoothPath(headPts);
  const bodyCol = mixHex(b.skin, b.furCol, clamp01(b.fur * 1.15));
  const alpha = 1 - b.clear * 0.4;
  ctx.globalAlpha = alpha;

  const topAll = Math.min(...sk.spine.map((p, i) => p[1] - sk.dors[i]), ...headPts.map(p => p[1]));
  const botAll = b.posture > 0.5 ? 0 : Math.max(...sk.spine.map((p, i) => p[1] + sk.vent[i]), ...headPts.map(p => p[1]));
  const bodyFill = litFill(ctx, topAll, botAll, bodyCol, b.under, 1 - b.posture * 0.8);
  const limbFill = bodyFill;
  // far limbs behind everything, in shadow
  for (const l of sk.limbs) if (l.far) drawLimb(ctx, l, b, bodyCol, true, lw, limbFill, body);

  // the tail fin, behind the body
  if (b.tailFin > 0.02) {
    const tip = sk.spine[0], pre = sk.spine[2];
    const a = Math.atan2(tip[1] - pre[1], tip[0] - pre[0]);
    const flick = Math.sin(pose.phase * TAU) * b.swim;
    ctx.save();
    ctx.translate(tip[0], tip[1]);
    ctx.rotate(a);
    const fl = b.tailFin * 0.42, fh = b.tailFin * 0.36 * (1 - Math.abs(flick) * 0.35);
    const g = ctx.createLinearGradient(0, -fh, 0, fh);
    g.addColorStop(0, shade(b.skin, 0.15)); g.addColorStop(1, shade(b.skin, -0.2));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-0.1, 0);
    ctx.quadraticCurveTo(fl * 0.45, -fh * 0.55, fl, -fh);
    ctx.quadraticCurveTo(fl * 0.72, -fh * 0.1, fl * 0.8, 0);
    ctx.quadraticCurveTo(fl * 0.72, fh * 0.1, fl, fh);
    ctx.quadraticCurveTo(fl * 0.45, fh * 0.55, -0.1, 0);
    ctx.fill();
    ctx.strokeStyle = 'rgba(20, 20, 10, 0.22)'; ctx.lineWidth = lw * 0.8;
    for (let i = 0; i < 11; i++) { const k = i / 10; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(fl * (0.85 - 0.1 * Math.sin(k * Math.PI)), -fh + k * 2 * fh); ctx.stroke(); }
    ctx.restore();
  }
  // the fin along the back
  if (b.dorsalFin > 0.02) {
    const e = edge(sk, sk.iHip + 2, sk.iHip + 9, 1, 0.5);
    if (e.pts.length > 2) {
      ctx.fillStyle = shade(b.skin, -0.08);
      ctx.beginPath();
      ctx.moveTo(e.pts[0][0], e.pts[0][1]);
      e.pts.forEach((p, i) => {
        const k = i / (e.pts.length - 1);
        const hgt = Math.sin(Math.pow(k, 0.55) * Math.PI) * 0.17 * b.dorsalFin;
        ctx.lineTo(p[0] + e.dirs[i][0] * hgt - k * 0.04 * b.dorsalFin, p[1] + e.dirs[i][1] * hgt);
      });
      ctx.lineTo(e.pts[e.pts.length - 1][0], e.pts[e.pts.length - 1][1]);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(20, 20, 10, 0.2)'; ctx.lineWidth = lw * 0.8; ctx.stroke();
    }
  }

  // the body and the head, filled as one shape so the neck is not a seam
  const whole = new Path2D();
  whole.addPath(body);
  whole.addPath(head);
  const allY = [...sk.spine.map((p, i) => p[1] - sk.dors[i]), ...headPts.map(p => p[1])];
  const top = Math.min(...allY);
  const bot = Math.max(...sk.spine.map((p, i) => p[1] + sk.vent[i]), ...headPts.map(p => p[1]));
  ctx.fillStyle = bodyFill;
  ctx.fill(body);
  const headCol = mixHex(b.skin, b.furCol, clamp01(b.fur * 0.9));
  // a head on a neck has its own light; a fish's head is the front of its body and shares it
  ctx.fillStyle = b.neck > 0.05 && b.posture < 0.5 ? litFill(ctx, Math.min(...headPts.map(p => p[1])), Math.max(...headPts.map(p => p[1])), headCol, b.under, 1 - b.posture * 0.6) : bodyFill;
  ctx.fill(head);
  // a bare face on a furry primate: the muzzle and round the eyes are skin
  if (b.fur > 0.3 && b.eyeFront > 0.3) {
    ctx.save(); ctx.clip(head);
    const c = hp([hl.face - 0.12, 0.08]);
    const fg = ctx.createRadialGradient(c[0], c[1], 0, c[0], c[1], sk.L * 0.42);
    fg.addColorStop(0, shade(mixHex(b.skin, '#c89a7a', 0.25), 0.05)); fg.addColorStop(0.7, b.skin); fg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha *= clamp01(b.fur) * clamp01(b.eyeFront);
    ctx.fillStyle = fg;
    ctx.beginPath(); ctx.arc(c[0], c[1], sk.L * 0.42, 0, TAU); ctx.fill();
    ctx.restore();
  }

  // texture: scales, the muscle blocks of the first swimmers, and a sheen where the light falls
  ctx.save();
  ctx.clip(whole);
  ctx.save();
  ctx.clip(body);
  if (b.scales > 0.05) {
    ctx.strokeStyle = `rgba(20, 25, 12, ${0.2 * b.scales})`;
    ctx.lineWidth = lw * 0.9;
    const r = 0.028;
    for (let i = 0; i < sk.spine.length; i++) {
      const p = sk.spine[i];
      const span = Math.max(sk.dors[i], sk.vent[i]);
      for (let j = -Math.ceil(span / r); j <= Math.ceil(span / r); j++) {
        const cx = p[0] + ((j + i) % 2 ? r * 0.9 : 0), cy = p[1] + j * r * 1.1;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0.3, Math.PI - 0.3); ctx.stroke();
      }
    }
  }
  ctx.restore();
  if (b.clear > 0.05) {
    ctx.strokeStyle = `rgba(110, 70, 60, ${0.4 * b.clear})`;
    ctx.lineWidth = lw * 1.2;
    for (let i = 2; i < sk.spine.length - 3; i++) {
      const p = sk.spine[i], r = (sk.dors[i] + sk.vent[i]) / 2;
      ctx.beginPath(); ctx.moveTo(p[0] + r * 0.25, p[1] - r * 0.9); ctx.lineTo(p[0] - r * 0.3, p[1]); ctx.lineTo(p[0] + r * 0.25, p[1] + r * 0.9); ctx.stroke();
    }
    // the gut, seen through the body
    ctx.strokeStyle = `rgba(150, 90, 60, ${0.35 * b.clear})`; ctx.lineWidth = lw * 2.5;
    ctx.beginPath(); sk.spine.slice(3, sk.iSh).forEach((p, i) => (i ? ctx.lineTo(p[0], p[1] + sk.vent[i + 3] * 0.45) : ctx.moveTo(p[0], p[1] + sk.vent[3] * 0.45))); ctx.stroke();
  }
  if (b.fur > 0.05) {
    // strands inside the body, leaning back, in two tones
    const n = 420;
    for (const [tone, seed] of [[shade(b.furCol, 0.25), 5], [shade(b.furCol, -0.3), 9]] as Array<[string, number]>) {
      ctx.strokeStyle = tone; ctx.lineWidth = lw * 1.1; ctx.globalAlpha = 0.28 * b.fur * alpha;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const f = hash(i, seed) * (sk.spine.length - 2) + 1;
        const j = Math.floor(f), p = sk.spine[j], q = sk.spine[j - 1];
        const dx = p[0] - q[0], dy = p[1] - q[1], d = Math.hypot(dx, dy);
        if (d < 1e-6) continue;
        const off = (hash(i, seed + 1) - 0.5) * 2;
        const r = off > 0 ? sk.dors[j] * off : sk.vent[j] * off;
        const cx = p[0] + (dy / d) * r, cy = p[1] - (dx / d) * r;
        ctx.moveTo(cx, cy); ctx.lineTo(cx - dx / d * 0.03, cy - dy / d * 0.03 + 0.008);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = alpha;
  }
  ctx.lineJoin = 'round';
  {
    const backPts = edge(sk, 0.3, sk.iSh + 2, 1, 0.25).pts;
    const bellyPts = edge(sk, 0.3, sk.iSh + 2, -1, 0.25).pts;
    const line = (pts: P[]): Path2D => { const q = new Path2D(); pts.forEach((p, i) => (i ? q.lineTo(p[0], p[1]) : q.moveTo(p[0], p[1]))); return q; };
    ctx.save(); ctx.lineCap = 'round';
    ctx.strokeStyle = `rgba(255, 244, 225, ${0.18 * (1 - b.fur * 0.5)})`; ctx.lineWidth = b.girth * 0.18;
    ctx.save(); ctx.translate(0.01 * Math.sin(sk.theta), 0.016); ctx.stroke(line(backPts)); ctx.restore();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.16)'; ctx.lineWidth = b.girth * 0.2;
    ctx.save(); ctx.translate(-0.012 * Math.sin(sk.theta), -0.02); ctx.stroke(line(bellyPts)); ctx.restore();
    ctx.restore();
    // light along the top of the head only: along the jaw it would read as a collar
    ctx.save(); ctx.clip(head);
    const jawY = hp([0.5, 0.2])[1];
    ctx.beginPath(); ctx.rect(-10, -10, 20, jawY + 10); ctx.clip();
    ctx.translate(0.008, 0.016);
    ctx.strokeStyle = `rgba(255, 244, 225, ${0.14 * (1 - b.fur * 0.5)})`; ctx.lineWidth = sk.H * 0.12;
    ctx.stroke(head); ctx.restore();
    // form: light on the chest and shoulder, shadow low on the belly and behind the hip
    if (b.posture > 0.3) {
      const ch = sk.spine[sk.iHip + Math.round((sk.iSh - sk.iHip) * 0.75)];
      const cg = ctx.createRadialGradient(ch[0] + b.girth * 0.3, ch[1], 0, ch[0] + b.girth * 0.3, ch[1], b.girth * 1.6);
      cg.addColorStop(0, `rgba(255, 230, 200, ${0.12 * b.posture})`); cg.addColorStop(1, 'rgba(255, 230, 200, 0)');
      ctx.fillStyle = cg; ctx.fillRect(-5, -5, 10, 10);
      const hp0 = sk.spine[sk.iHip + 1];
      const hg = ctx.createRadialGradient(hp0[0] - b.girth * 0.4, hp0[1], 0, hp0[0] - b.girth * 0.4, hp0[1], b.girth * 1.4);
      hg.addColorStop(0, `rgba(0, 0, 0, ${0.14 * b.posture})`); hg.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = hg; ctx.fillRect(-5, -5, 10, 10);
    }
  }
  const sheen = ctx.createLinearGradient(0, top, 0, top + (bot - top) * 0.35);
  sheen.addColorStop(0, `rgba(255, 250, 235, ${0.2 * (1 - b.fur) + 0.05})`);
  sheen.addColorStop(1, 'rgba(255,250,235,0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(-5, top, 10, (bot - top) * 0.35);
  ctx.restore();

  // fur along the back, the belly and the head: the soft edge that says "fur" from across a room
  if (b.fur > 0.05) {
    const furCol = shade(b.furCol, -0.2);
    const back = edge(sk, 0.3, sk.spine.length - 1, 1, 0.1);
    const under = edge(sk, 0.3, sk.spine.length - 1, -1, 0.14);
    furAlong(ctx, back.pts, back.dirs, 0.022, furCol, b.fur, 1, lw);
    furAlong(ctx, under.pts, under.dirs, 0.018, furCol, b.fur * 0.7, 2, lw);
    const hpts: P[] = [], hdirs: P[] = [];
    for (let i = 0; i < 70; i++) {
      const k = i / 69;
      const q = hp([mix(0.02, hl.brow - 0.05, k), mix(0.1, hl.top, Math.sin(Math.min(1, k * 1.5) * Math.PI / 2)) + 0.02]);
      hpts.push(q); hdirs.push([mix(-1, -0.2, k), -1]);
    }
    furAlong(ctx, hpts, hdirs, 0.014, furCol, b.fur * (1 - b.hair), 7, lw);
  }

  // the wrap: a hide round the hips, hanging to the middle of the thigh, with a ragged hem
  if (b.wrap > 0.02) {
    ctx.save();
    ctx.globalAlpha *= b.wrap;
    const at = (v: number, side: 1 | -1, out: number): P => {
      const f = sk.iHip + v * (sk.iSh - sk.iHip);
      const i = Math.floor(f), j = Math.min(sk.spine.length - 1, i + 1), k = f - i;
      const c: P = [sk.spine[i][0] + (sk.spine[j][0] - sk.spine[i][0]) * k, sk.spine[i][1] + (sk.spine[j][1] - sk.spine[i][1]) * k];
      const dx = Math.cos(sk.theta), dy = -Math.sin(sk.theta);
      const r = (side > 0 ? sk.dors[i] : sk.vent[i]) + out;
      return [c[0] + dy * r * side, c[1] - dx * r * side];
    };
    const wb = at(0.22, 1, 0.015), wf = at(0.22, -1, 0.015);
    const drop = 0.46;
    const hb: P = [wb[0] - 0.05, wb[1] + drop + 0.04], hf: P = [wf[0] + 0.05, wf[1] + drop - 0.03];
    const pts: P[] = [wb, [wb[0] - 0.04, wb[1] + drop * 0.5]];
    for (let i = 0; i <= 10; i++) {
      const k = i / 10;
      pts.push([hb[0] + (hf[0] - hb[0]) * k, hb[1] + (hf[1] - hb[1]) * k + (i % 2 ? 0.025 : -0.005)]);
    }
    pts.push([wf[0] + 0.04, wf[1] + drop * 0.5], wf);
    const wp = new Path2D();
    pts.forEach((q, i) => (i ? wp.lineTo(q[0], q[1]) : wp.moveTo(q[0], q[1])));
    wp.closePath();
    const wg = ctx.createLinearGradient(wb[0], wb[1], hf[0], hf[1]);
    wg.addColorStop(0, '#9a7048'); wg.addColorStop(1, '#6a482c');
    ctx.fillStyle = wg;
    ctx.fill(wp);
    ctx.strokeStyle = 'rgba(50, 30, 15, 0.6)'; ctx.lineWidth = lw * 1.3; ctx.stroke(wp);
    // a thong round the waist
    ctx.strokeStyle = '#5a3a20'; ctx.lineWidth = lw * 3;
    ctx.beginPath(); ctx.moveTo(wb[0], wb[1]); ctx.lineTo(wf[0], wf[1]); ctx.stroke();
    ctx.restore();
  }

  // ---- the head's details
  const [ex, ey] = hp(hl.eye);
  const eyeR = sk.L * 0.05 * b.eye + 0.004;
  const fishK = b.swim * (1 - clamp01(b.leg * 3));
  if (fishK > 0.05) {
    // the gill cover, an arc behind the eye
    const g0 = hp([0.3, -0.35]), g1 = hp([0.22, 0.05]), g2 = hp([0.3, 0.42]);
    ctx.strokeStyle = `rgba(20, 20, 10, ${0.4 * fishK})`; ctx.lineWidth = lw * 1.6;
    ctx.beginPath(); ctx.moveTo(g0[0], g0[1]); ctx.quadraticCurveTo(g1[0], g1[1], g2[0], g2[1]); ctx.stroke();
  }
  const lk = clamp01((b.eyeFront - 0.5) * 2) * clamp01(1 - b.snout * 1.6);
  // face shading on a primate: shadow in the eye socket and under the cheekbone, light on the cheek,
  // the brow and the chin - what turns a flat profile into a face
  if (lk > 0.05) {
    ctx.save();
    ctx.clip(head);
    const cheek = hp([hl.brow - 0.12, 0.1]);
    const cg = ctx.createRadialGradient(cheek[0], cheek[1], 0, cheek[0], cheek[1], sk.L * 0.22);
    cg.addColorStop(0, `rgba(255, 225, 195, ${0.16 * lk})`); cg.addColorStop(1, 'rgba(255, 225, 195, 0)');
    ctx.fillStyle = cg; ctx.fillRect(-5, -5, 10, 10);
    const sock = hp([hl.eye[0], hl.eye[1] - 0.02]);
    const sg = ctx.createRadialGradient(sock[0], sock[1], 0, sock[0], sock[1], sk.L * 0.12);
    sg.addColorStop(0, `rgba(30, 10, 0, ${0.28 * lk})`); sg.addColorStop(1, 'rgba(30, 10, 0, 0)');
    ctx.fillStyle = sg; ctx.fillRect(-5, -5, 10, 10);
    const under = hp([hl.brow - 0.1, 0.3]);
    const ug = ctx.createRadialGradient(under[0], under[1], 0, under[0], under[1], sk.L * 0.2);
    ug.addColorStop(0, `rgba(30, 10, 0, ${0.14 * lk})`); ug.addColorStop(1, 'rgba(30, 10, 0, 0)');
    ctx.fillStyle = ug; ctx.fillRect(-5, -5, 10, 10);
    ctx.strokeStyle = `rgba(40, 15, 5, ${0.25 * lk})`; ctx.lineWidth = lw * 1.2;
    const n0 = hp([hl.face - 0.02 + b.nose * 0.02, 0.14]), n1 = hp([hl.face - 0.08, 0.24]), n2 = hp([hl.face - 0.06, 0.33]);
    ctx.beginPath(); ctx.moveTo(n0[0], n0[1]); ctx.quadraticCurveTo(n1[0], n1[1], n2[0], n2[1]); ctx.stroke();
    if (b.nose > 0.3) {
      const l0 = hp([hl.face - 0.03, 0.2]), l1 = hp([hl.face + 0.02, 0.32]);
      ctx.fillStyle = `rgba(120, 40, 35, ${0.25 * b.nose})`;
      ctx.beginPath(); ctx.ellipse((l0[0] + l1[0]) / 2, (l0[1] + l1[1]) / 2, sk.L * 0.035, sk.H * 0.07, 0.2, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
  if (b.ear > 0.05) {
    const [erx, ery] = hp(hl.ear);
    if (lk > 0.3) {
      // a primate's ear: a rim that curls round from the top to the lobe, and the bowl inside it
      const eh = sk.H * mix(0.24, 0.3, b.posture) * b.ear / 0.6;
      const ew = eh * mix(0.75, 0.6, b.posture);
      ctx.save();
      ctx.translate(erx, ery);
      ctx.rotate(-0.15 - sk.headAng);
      const eg = ctx.createLinearGradient(-ew, 0, ew, 0);
      eg.addColorStop(0, shade(headCol, -0.18)); eg.addColorStop(1, shade(headCol, 0.08));
      ctx.fillStyle = eg;
      const ep = new Path2D();
      ep.moveTo(ew * 0.3, -eh * 0.45);
      ep.bezierCurveTo(-ew * 0.4, -eh * 0.7, -ew * 0.9, -eh * 0.1, -ew * 0.55, eh * 0.3);
      ep.bezierCurveTo(-ew * 0.35, eh * 0.62, ew * 0.05, eh * 0.62, ew * 0.2, eh * 0.35);
      ep.bezierCurveTo(ew * 0.35, eh * 0.1, ew * 0.55, -eh * 0.1, ew * 0.3, -eh * 0.45);
      ctx.fill(ep);
      ctx.strokeStyle = 'rgba(40, 15, 5, 0.45)'; ctx.lineWidth = lw * 1.3; ctx.stroke(ep);
      ctx.beginPath(); ctx.moveTo(ew * 0.15, -eh * 0.32); ctx.bezierCurveTo(-ew * 0.35, -eh * 0.45, -ew * 0.6, 0, -ew * 0.35, eh * 0.2); ctx.stroke();
      ctx.fillStyle = 'rgba(50, 20, 10, 0.35)';
      ctx.beginPath(); ctx.ellipse(ew * 0.02, eh * 0.02, ew * 0.18, eh * 0.2, 0.3, 0, TAU); ctx.fill();
      ctx.restore();
    } else {
      const er = sk.L * 0.11 * b.ear;
      const P2 = b.posture;
      ctx.save();
      ctx.translate(erx, ery);
      ctx.rotate(mix(-0.6, 0.12, P2) - sk.headAng);
      const eg = ctx.createLinearGradient(0, -er, 0, er);
      eg.addColorStop(0, shade(headCol, 0.05)); eg.addColorStop(1, shade(headCol, -0.2));
      ctx.fillStyle = eg;
      ctx.beginPath(); ctx.ellipse(0, -er * 0.4 * (1 - P2), er * mix(0.62, 0.52, P2), er * mix(1, 0.95, P2), 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(40, 20, 10, 0.4)'; ctx.lineWidth = lw * 1.3;
      ctx.beginPath(); ctx.ellipse(0, -er * 0.4 * (1 - P2), er * 0.3, er * 0.6, 0, -1.4, 1.9); ctx.stroke();
      ctx.restore();
    }
  }
  // head hair: it grows from the skull, above a hairline that runs from the forehead past the
  // temple, over the ear and down to the nape; its outer edge is the skull pushed out, bumpy with curls
  if (b.hair > 0.05) {
    ctx.save();
    const hk = Math.min(1.2, b.hair);
    ctx.globalAlpha *= Math.min(1, b.hair * 1.5);
    const th = 0.09 * hk;
    const skull: P[] = [
      [hl.brow - 0.07, hl.top * 0.74], [hl.brow - 0.14, hl.top * 0.93], [0.4, hl.top], [0.22, hl.top * 0.97],
      [0.05, hl.top * 0.62], [-0.005, 0.06], [0.06, 0.28],
    ];
    const cx = 0.4, cy = 0.05;
    const outer: P[] = [];
    skull.forEach((q, i) => {
      const w = [0.25, 0.7, 1, 1, 1, 0.9, 0.5][i];
      const dx = q[0] - cx, dy = (q[1] - cy) * sk.H / sk.L, d = Math.hypot(dx, dy) || 1;
      outer.push([q[0] + dx / d * th * w, q[1] + (dy / d * th * w) * sk.L / sk.H]);
    });
    const hairline: P[] = [
      [0.1, 0.3], [0.2, 0.08], [hl.ear[0] - 0.09, hl.ear[1] - 0.14], [hl.ear[0] + 0.04, hl.ear[1] - 0.26], [hl.brow - 0.13, -0.26], [hl.brow - 0.08, hl.top * 0.62],
    ];
    const hpth = smoothPath([...outer, ...hairline].map(hp));
    const ys = outer.map(q => hp(q)[1]);
    const hg = ctx.createLinearGradient(0, Math.min(...ys), 0, Math.max(...ys));
    hg.addColorStop(0, shade(b.hairCol, 0.22)); hg.addColorStop(1, shade(b.hairCol, -0.2));
    ctx.fillStyle = hg;
    ctx.fill(hpth);
    ctx.save(); ctx.clip(hpth);
    for (let i = 0; i < 260; i++) {
      const q = hp([mix(-0.05, hl.brow - 0.02, hash(i, 3)), mix(hl.top - 0.1, 0.3, hash(i, 4))]);
      const light = 0.12 + 0.2 * (1 - hash(i, 4));
      ctx.strokeStyle = `rgba(255, 240, 220, ${light})`; ctx.lineWidth = lw * 0.9;
      ctx.beginPath(); ctx.arc(q[0], q[1], sk.L * 0.011, hash(i, 5) * TAU, hash(i, 5) * TAU + 4); ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = shade(b.hairCol, -0.05);
    for (let i = 0; i < 48; i++) {
      const k = i / 47;
      const seg = Math.min(outer.length - 2, Math.floor(k * (outer.length - 1)));
      const f = k * (outer.length - 1) - seg;
      const q = hp([outer[seg][0] + (outer[seg + 1][0] - outer[seg][0]) * f, outer[seg][1] + (outer[seg + 1][1] - outer[seg][1]) * f]);
      ctx.beginPath(); ctx.arc(q[0], q[1], sk.L * 0.014 * hk, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
  // the mouth
  if (b.jaw > 0.3) {
    const m = hp(hl.mouth), lp = hp(hl.lip);
    const open = (pose.bite ?? 0) * 0.18;
    ctx.strokeStyle = 'rgba(30, 12, 8, 0.6)'; ctx.lineWidth = lw * 1.6;
    ctx.beginPath(); ctx.moveTo(m[0], m[1]); ctx.quadraticCurveTo((m[0] + lp[0]) / 2, (m[1] + lp[1]) / 2 + 0.004, lp[0], lp[1]); ctx.stroke();
    if (open > 0.01) {
      const lo = hp([hl.lip[0] - 0.02, hl.lip[1] + open * 2.2]);
      ctx.fillStyle = '#2a0e0a';
      ctx.beginPath(); ctx.moveTo(m[0], m[1]); ctx.lineTo(lp[0], lp[1]); ctx.lineTo(lo[0], lo[1]); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#f2ecdc';
      for (let i = 0; i < 5; i++) {
        const k = (i + 0.5) / 5;
        const tx = m[0] + (lp[0] - m[0]) * k, ty = m[1] + (lp[1] - m[1]) * k;
        ctx.beginPath(); ctx.moveTo(tx - lw * 2, ty); ctx.lineTo(tx, ty + sk.H * 0.08); ctx.lineTo(tx + lw * 2, ty); ctx.fill();
      }
    }
  } else {
    const m = hp([hl.face - 0.02, 0.28]);
    ctx.strokeStyle = 'rgba(50, 25, 20, 0.6)'; ctx.lineWidth = lw * 1.4;
    ctx.beginPath(); ctx.ellipse(m[0], m[1], sk.L * 0.035, sk.H * 0.09, 0, 0, TAU); ctx.stroke();
  }
  // nostril, and the wing of a nose that sticks out
  if (b.nose > 0.1 || b.snout > 0.25) {
    const n = hp(hl.nose);
    ctx.fillStyle = 'rgba(30, 12, 8, 0.5)';
    ctx.beginPath(); ctx.ellipse(n[0] - sk.L * 0.03, n[1] + sk.H * 0.05, sk.L * 0.02, sk.H * 0.018, 0.4, 0, TAU); ctx.fill();
    if (b.nose > 0.3) {
      ctx.strokeStyle = `rgba(30, 12, 8, ${0.3 * b.nose})`; ctx.lineWidth = lw * 1.2;
      ctx.beginPath(); ctx.arc(n[0] - sk.L * 0.05, n[1] + sk.H * 0.03, sk.L * 0.045, -0.4, 2.2); ctx.stroke();
    }
  }
  // the brow ridge's shadow over the eye
  if (b.brow > 0.2) {
    ctx.fillStyle = `rgba(0,0,0,${0.22 * b.brow})`;
    ctx.beginPath(); ctx.ellipse(ex, ey - eyeR * 0.4, eyeR * 2.1, eyeR * 1.4, 0, Math.PI, 0); ctx.fill();
  }
  // the eye: in people a white around the iris, in everything else dark and round
  if (b.sclera > 0.05) {
    ctx.fillStyle = mixHex('#3a2a20', '#f2ece2', b.sclera);
    ctx.beginPath(); ctx.ellipse(ex, ey, eyeR * 1.3, eyeR * 0.78, 0, 0, TAU); ctx.fill();
  }
  const irisX = ex + eyeR * 0.35 * b.sclera;
  ctx.fillStyle = '#16100a';
  ctx.beginPath(); ctx.arc(irisX, ey, eyeR * mix(1, 0.7, b.sclera), 0, TAU); ctx.fill();
  ctx.fillStyle = mixHex(mixHex('#c89b3c', '#8a6a2a', b.eyeFront), '#4a2e1a', clamp01(b.posture));
  ctx.beginPath(); ctx.arc(irisX, ey, eyeR * mix(0.6, 0.55, b.sclera), 0, TAU); ctx.fill();
  ctx.fillStyle = '#080402';
  ctx.beginPath(); ctx.arc(irisX, ey, eyeR * 0.28, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.beginPath(); ctx.arc(irisX - eyeR * 0.2, ey - eyeR * 0.28, eyeR * 0.2, 0, TAU); ctx.fill();
  if (b.sclera > 0.3 || b.fur > 0.3) {
    // an upper lid line
    ctx.strokeStyle = 'rgba(30, 15, 8, 0.55)'; ctx.lineWidth = lw * 1.3;
    ctx.beginPath(); ctx.ellipse(ex, ey, eyeR * 1.35, eyeR * 0.85, 0, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
  }
  if (b.sclera > 0.4) {
    // an eyebrow, and a hint of the lips
    ctx.strokeStyle = shade(b.hairCol, 0.1); ctx.lineWidth = eyeR * 0.45; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(ex - eyeR * 1.3, ey - eyeR * 1.35); ctx.quadraticCurveTo(ex, ey - eyeR * 1.9, ex + eyeR * 1.5, ey - eyeR * 1.45); ctx.stroke();
    const lip = hp([hl.face - 0.01, 0.29]);
    ctx.fillStyle = 'rgba(90, 30, 25, 0.35)';
    ctx.beginPath(); ctx.ellipse(lip[0] - sk.L * 0.015, lip[1], sk.L * 0.025, sk.H * 0.04, 0, 0, TAU); ctx.fill();
  }
  if ((pose.t + 1.3) % 4.4 < 0.13) {
    ctx.fillStyle = headCol;
    ctx.beginPath(); ctx.ellipse(ex, ey, eyeR * 1.45, eyeR * 1.1, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = lw * 1.2;
    ctx.beginPath(); ctx.moveTo(ex - eyeR * 1.2, ey + eyeR * 0.2); ctx.quadraticCurveTo(ex, ey + eyeR * 0.5, ex + eyeR * 1.2, ey + eyeR * 0.2); ctx.stroke();
  }
  if (b.whisker > 0.05) {
    ctx.strokeStyle = `rgba(245, 240, 225, ${0.65 * b.whisker})`; ctx.lineWidth = lw * 0.8;
    const np = hp([hl.face - 0.06, 0.12]);
    const tw = (pose.sniff ?? 0) * 0.08;
    for (let i = 0; i < 5; i++) {
      const a = -0.3 + i * 0.16 + Math.sin(pose.t * (3 + tw * 60) + i) * (0.03 + tw);
      ctx.beginPath(); ctx.moveTo(np[0], np[1]);
      ctx.quadraticCurveTo(np[0] + sk.L * 0.2, np[1] + a * sk.H * 0.2, np[0] + sk.L * 0.45, np[1] + a * sk.H * 1.2);
      ctx.stroke();
    }
  }

  // near limbs, in front
  for (const l of sk.limbs) if (!l.far) drawLimb(ctx, l, b, bodyCol, false, lw, limbFill, body);

  // a thin darker rim, so the animal reads against any background
  ctx.strokeStyle = 'rgba(15, 10, 5, 0.3)';
  ctx.lineWidth = lw * 1.3;
  const outside = (p: Path2D): Path2D => { const o = new Path2D(); o.rect(-20, -20, 40, 40); o.addPath(p); return o; };
  ctx.save(); ctx.clip(outside(head), 'evenodd'); ctx.stroke(body); ctx.restore();
  ctx.save(); ctx.clip(outside(body), 'evenodd'); ctx.stroke(head); ctx.restore();
  ctx.globalAlpha = 1;

  if (pose.xray > 0.01) drawBones(ctx, sk, b, hl, head, body, pose, lw);
  ctx.restore();
}

/** The X-ray: the body goes dark and see-through and the bones light up, in the three colours. */
function drawBones(ctx: Ctx, sk: Skeleton, b: Body, hl: HeadLand, head: Path2D, body: Path2D, pose: Pose, lw: number): void {
  const k = pose.xray;
  const hp = (q: P): P => headPoint(sk, q);
  ctx.save();
  ctx.globalAlpha = k * 0.84;
  ctx.fillStyle = '#0b1828';
  ctx.fill(body);
  ctx.fill(head);
  for (const l of sk.limbs) { ctx.fill(limbPath(l, b)); ctx.fill(extremityPath(l, b)); }
  ctx.globalAlpha = k * 0.55;
  ctx.strokeStyle = '#78c0ff'; ctx.lineWidth = lw * 1.4;
  ctx.stroke(body); ctx.stroke(head);
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = k;
  const pick = (part: Pose['show']): number => (pose.show === part ? 1 + 0.4 * (0.5 + 0.5 * Math.sin(pose.t * 5)) : 1);
  const glow = (colour: string, n = 8): void => { ctx.shadowColor = colour; ctx.shadowBlur = n; };
  // the brain in its case: a small bulb in a fish, most of the head in a person
  const bc = hp([0.36, hl.top * 0.42]);
  const brx = sk.L * (0.14 + b.dome * 0.24), bry = sk.H * (0.14 + b.dome * 0.26);
  const bp = pick('brain');
  const bg = ctx.createRadialGradient(bc[0], bc[1], 0, bc[0], bc[1], Math.max(brx, bry));
  bg.addColorStop(0, `rgba(255, 170, 190, ${0.75 * bp})`); bg.addColorStop(1, `rgba(230, 110, 150, ${0.45 * bp})`);
  ctx.fillStyle = bg; glow('#ff8fb8', 10 * bp);
  ctx.beginPath(); ctx.ellipse(bc[0], bc[1], brx, bry, -sk.headAng, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(160, 60, 100, 0.5)'; ctx.lineWidth = lw; ctx.shadowBlur = 0;
  for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(bc[0], bc[1], brx * (0.3 + i * 0.18), bry * (0.25 + i * 0.18), -sk.headAng + i, 0.5, 2.4); ctx.stroke(); }
  // the skull: its outline inside the head, the eye socket, the jaw
  ctx.strokeStyle = BONE.skull; glow(BONE.skull);
  ctx.lineWidth = lw * 2.2;
  const inner = hl.pts.map(q => hp([mix(q[0], 0.5, 0.06), mix(q[1], 0, 0.08)]));
  ctx.stroke(smoothPath(inner));
  const [ex, ey] = hp(hl.eye);
  ctx.beginPath(); ctx.arc(ex, ey, sk.L * 0.085 + 0.004, 0, TAU); ctx.stroke();
  if (b.jaw > 0.3) {
    ctx.lineWidth = lw * 3 * pick('jaw');
    const m = hp(hl.mouth);
    const jp = [m, ...hl.jaw.map(q => hp([mix(q[0], 0.5, 0.06), mix(q[1], 0, 0.08)]))];
    ctx.beginPath(); ctx.moveTo(hp(hl.lip)[0], hp(hl.lip)[1]); jp.slice(1).forEach(p => ctx.lineTo(p[0], p[1])); ctx.stroke();
    ctx.fillStyle = BONE.skull;
    const lp = hp(hl.lip);
    for (let i = 0; i < 5; i++) {
      const q = (i + 0.5) / 5;
      ctx.beginPath(); ctx.arc(m[0] + (lp[0] - m[0]) * q, m[1] + (lp[1] - m[1]) * q, lw * 1.6, 0, TAU); ctx.fill();
    }
  }
  // the backbone: a rod first, then a chain of little bones, from the skull to the tip of the tail
  const sp = sk.spine;
  const spinePick = pick('spine');
  if (b.vert < 0.99) {
    ctx.globalAlpha = k * (1 - b.vert);
    glow('#ffe7b0', 12 * spinePick);
    strokeLine(ctx, sp, Math.max(lw * 3, 0.018) * spinePick, '#f0dcae');
    ctx.globalAlpha = k;
  }
  if (b.vert > 0.01) {
    ctx.fillStyle = BONE.spine; glow(BONE.spine);
    ctx.globalAlpha = k * b.vert;
    for (let i = 0; i < sp.length - 1; i++) {
      const a = sp[i], c = sp[i + 1];
      if (Math.hypot(c[0] - a[0], c[1] - a[1]) < 1e-5) continue;
      const tailPick = i < sk.iHip ? pick('tail') : 1;
      const r = Math.max(lw * 1.6, Math.min(sk.dors[i], 0.2) * 0.2) * spinePick * tailPick;
      ctx.beginPath(); ctx.ellipse((a[0] + c[0]) / 2, (a[1] + c[1]) / 2, r * 1.25, r, Math.atan2(c[1] - a[1], c[0] - a[0]), 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = k;
  }
  // ribs along the chest
  if (b.ribs > 0.05) {
    ctx.strokeStyle = BONE.spine; ctx.lineWidth = lw * 1.8; ctx.globalAlpha = k * b.ribs * 0.9;
    for (let i = sk.iHip + 3; i < sk.iSh; i++) {
      const a = sp[i - 1], c = sp[i + 1];
      const dx = c[0] - a[0], dy = c[1] - a[1], d = Math.hypot(dx, dy) || 1;
      const nx = dy / d, ny = -dx / d;
      const r = sk.vent[i] * 0.85;
      ctx.beginPath(); ctx.moveTo(sp[i][0], sp[i][1]);
      ctx.quadraticCurveTo(sp[i][0] - nx * r * 0.7 - dx / d * 0.04, sp[i][1] - ny * r * 0.7 - dy / d * 0.04, sp[i][0] - nx * r - dx / d * 0.1, sp[i][1] - ny * r - dy / d * 0.1);
      ctx.stroke();
    }
    ctx.globalAlpha = k;
  }
  // the limb bones: one bone, then two, then the little bones of the hand - in fin, leg and arm alike
  for (const l of sk.limbs) {
    if (l.far) continue;
    const armPick = l.front ? pick('arm') : 1;
    const w = Math.max(lw * 3, b.girth * 0.08) * armPick;
    glow(BONE.upper, 12 * armPick);
    strokeLine(ctx, [l.root, l.joint], w * 1.3, BONE.upper);
    const dx = l.end[0] - l.joint[0], dy = l.end[1] - l.joint[1], d = Math.hypot(dx, dy) || 1;
    const ox = (-dy / d) * w * 0.55, oy = (dx / d) * w * 0.55;
    glow(BONE.lower, 12 * armPick);
    strokeLine(ctx, [[l.joint[0] + ox, l.joint[1] + oy], [l.end[0] + ox, l.end[1] + oy]], w * 0.72, BONE.lower);
    strokeLine(ctx, [[l.joint[0] - ox, l.joint[1] - oy], [l.end[0] - ox, l.end[1] - oy]], w * 0.72, BONE.lower);
    glow(BONE.hand, 12 * armPick);
    ctx.fillStyle = BONE.hand;
    const hx = l.tip[0] - l.end[0], hy = l.tip[1] - l.end[1];
    for (let i = 0; i < 3; i++) {
      const q = 0.12 + i * 0.22;
      ctx.beginPath(); ctx.arc(l.end[0] + hx * q, l.end[1] + hy * q, w * 0.5, 0, TAU); ctx.fill();
    }
    const n = Math.max(1, Math.round(b.digits));
    const a = Math.atan2(hy, hx), len = Math.max(0.03, Math.hypot(hx, hy) * 0.55);
    const dp = pick('digits');
    for (let i = 0; i < n; i++) {
      const spread = (i / Math.max(1, n - 1) - 0.5) * mix(0.55, 1.1, b.sprawl) * (l.front && b.posture > 0.5 ? 0.3 : 1);
      const ga = a + spread;
      const base: P = [l.end[0] + hx * 0.6, l.end[1] + hy * 0.6];
      strokeLine(ctx, [base, [base[0] + Math.cos(ga) * len, base[1] + Math.sin(ga) * len]], w * 0.45 * dp, BONE.hand);
    }
    if (b.fin > 0.05) {
      ctx.globalAlpha = k * b.fin;
      ctx.strokeStyle = '#d9ecf5'; ctx.lineWidth = lw * 1; ctx.shadowBlur = 0;
      const fl = Math.hypot(l.tip[0] - l.root[0], l.tip[1] - l.root[1]) * 1.15 + 0.04;
      const fa = Math.atan2(l.tip[1] - l.root[1], l.tip[0] - l.root[0]);
      for (let i = 0; i < 10; i++) {
        const q = (i / 9 - 0.5) * 0.85;
        ctx.beginPath(); ctx.moveTo(l.end[0], l.end[1]); ctx.lineTo(l.root[0] + Math.cos(fa + q) * fl, l.root[1] + Math.sin(fa + q) * fl); ctx.stroke();
      }
      ctx.globalAlpha = k;
    }
    if (!l.front && b.leg > 0.15) {
      ctx.fillStyle = BONE.spine; glow(BONE.spine);
      ctx.beginPath(); ctx.ellipse(l.root[0], l.root[1] - 0.02, b.girth * 0.38, b.girth * 0.22, -sk.theta, 0, TAU); ctx.fill();
    }
    if (l.front && b.arm > 0.15) {
      // the shoulder blade
      ctx.fillStyle = BONE.spine; glow(BONE.spine);
      ctx.beginPath(); ctx.ellipse(l.root[0] - 0.03, l.root[1] - 0.05, b.girth * 0.3, b.girth * 0.18, -sk.theta + 0.6, 0, TAU); ctx.fill();
    }
  }
  ctx.restore();
}
