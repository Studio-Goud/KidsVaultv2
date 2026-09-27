/**
 * The worlds of the story journey: a place all the way round you, drawn in perspective.
 *
 * The camera stands still and turns (`look.ts`), so the world is a cylinder around it: a sky, far
 * ridges that wrap all the way round, the ground running from the horizon to your feet, and the
 * things standing on it - ferns, rocks, snowdrifts, trees - each at a real position in metres. A
 * thing twice as far away is drawn half as big and sits nearer the horizon, and far things are
 * softened by haze. That is all perspective is, and it is enough for a phone held at arm's length
 * to feel like a place you are standing in.
 *
 * Everything is drawn from numbers, as everywhere in Suri. Each world is a palette and a list of
 * props made from a seed, so it is the same place every time a child comes back.
 */

import { TAU, wrapAngle } from './look';
import { hexA } from '../render/look';

type Ctx = CanvasRenderingContext2D;

/** How high the camera is, in metres: a child sitting in the time drill. */
export const EYE = 1.2;

export interface View {
  w: number;
  h: number;
  yaw: number;
  /** pixels per radian: the lens */
  f: number;
  horizon: number;
}

export function makeView(w: number, h: number, yaw: number): View {
  // the lens is set by the longer side, so a phone on its side sees more of the world rather than
  // the same slice bigger
  const f = Math.max(w, h) * 0.55;
  return { w, h, yaw, f, horizon: h * 0.5 };
}

export const fovOf = (v: View): number => v.w / v.f;

export interface Spot {
  /** screen x of the thing's foot */
  x: number;
  /** screen y of the ground under it */
  y: number;
  /** pixels per metre at its distance */
  s: number;
  dist: number;
  /** how far it is from the middle of the screen, in radians */
  off: number;
  on: boolean;
}

/** Where a point on the ground (x metres to the right, z metres ahead at yaw 0) lands on screen. */
export function spot(v: View, x: number, z: number, lift = 0): Spot {
  const dist = Math.max(0.3, Math.hypot(x, z));
  const off = wrapAngle(Math.atan2(x, z) - v.yaw);
  const s = v.f / dist;
  return {
    x: v.w / 2 + off * v.f,
    y: v.horizon + (EYE - lift) * s,
    s, dist, off,
    on: Math.abs(off) < fovOf(v) / 2 + 0.35,
  };
}

/** The screen x of a direction (radians, world), whether or not it is in view. */
export const screenX = (v: View, angle: number): number => v.w / 2 + wrapAngle(angle - v.yaw) * v.f;

// ---------------------------------------------------------------- palettes

export interface Palette {
  skyTop: string;
  skyLow: string;
  sun: string;
  sunAt: number;
  sunUp: number;
  cloud: string;
  clouds: number;
  far: string;
  mid: string;
  ground: string;
  groundNear: string;
  haze: string;
  /** underwater: no horizon, light from above */
  water?: boolean;
  /** a row of far-off trees along the near ridge */
  treeline?: string;
}

export const PALETTES: Record<string, Palette> = {
  garden: {
    skyTop: '#5aa8e0', skyLow: '#d8eef8', sun: '#fff3c0', sunAt: 0.8, sunUp: 0.55,
    cloud: '#ffffff', clouds: 6, far: '#9cc28a', mid: '#6fa05a', ground: '#7fb562', groundNear: '#5f9444', haze: '#cfe6ee', treeline: '#5a8a4a',
  },
  ice: {
    skyTop: '#8fb0cc', skyLow: '#e6eef4', sun: '#fbf6e8', sunAt: -0.6, sunUp: 0.25,
    cloud: '#f2f5f8', clouds: 8, far: '#b8c9d8', mid: '#dfe8ef', ground: '#eef3f7', groundNear: '#dde6ee', haze: '#e8eef3', treeline: '#9fb2a8',
  },
  sea: {
    skyTop: '#1f6f8f', skyLow: '#0b3a52', sun: '#bfeaf5', sunAt: 0, sunUp: 1,
    cloud: '#9fd8e8', clouds: 0, far: '#15506a', mid: '#1b5f78', ground: '#c8b98a', groundNear: '#a8966a', haze: '#1d6280',
    water: true,
  },
  forest: {
    skyTop: '#6aa6c9', skyLow: '#f2e2b8', sun: '#fff0b0', sunAt: 1.1, sunUp: 0.35,
    cloud: '#fff7e6', clouds: 5, far: '#8aa58a', mid: '#4f7040', ground: '#6f8a44', groundNear: '#4a6428', haze: '#d9e2c2', treeline: '#46663a',
  },
};

// ---------------------------------------------------------------- the backdrop

/** A ridge that goes all the way round: whole-number frequencies, so it meets itself behind you. */
function ridgeHeight(angle: number, seed: number, amp: number): number {
  let y = 0;
  for (let k = 1; k <= 5; k++) y += Math.sin(angle * (k + 1) + seed * k * 1.7) * amp / k;
  return y;
}

export function drawBackdrop(ctx: Ctx, v: View, p: Palette, t: number): void {
  const { w, h } = v;
  const hz = v.horizon;
  const sky = ctx.createLinearGradient(0, 0, 0, hz);
  sky.addColorStop(0, p.skyTop); sky.addColorStop(1, p.skyLow);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, p.water ? h : hz + 2);

  if (p.water) {
    // light from the surface, shafts that sway, and the sand far below
    const sx = screenX(v, p.sunAt);
    for (let i = -6; i <= 6; i++) {
      const a = p.sunAt + i * 0.45 + Math.sin(t * 0.3 + i) * 0.04;
      const x = screenX(v, a);
      if (x < -w || x > w * 2) continue;
      ctx.fillStyle = `rgba(190, 235, 245, ${0.07 + 0.04 * Math.sin(t + i)})`;
      ctx.beginPath(); ctx.moveTo(x - 20, 0); ctx.lineTo(x + 30, 0); ctx.lineTo(x + 140, hz * 1.4); ctx.lineTo(x + 40, hz * 1.4); ctx.closePath(); ctx.fill();
    }
    void sx;
  } else {
    // the sun and its glow
    const sx = screenX(v, p.sunAt), sy = hz * (1 - p.sunUp * 0.9);
    const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, v.f * 0.5);
    g.addColorStop(0, p.sun); g.addColorStop(0.08, 'rgba(255,245,210,0.6)'); g.addColorStop(1, 'rgba(255,245,210,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, hz);
    // clouds at fixed places in the sky, drifting slowly round
    for (let i = 0; i < p.clouds; i++) {
      const a = (i / Math.max(1, p.clouds)) * TAU + t * 0.004 + i * 0.7;
      const x = screenX(v, a);
      if (x < -200 || x > w + 200) continue;
      const cy = hz * (0.2 + (i % 3) * 0.14), r = v.f * (0.05 + (i % 2) * 0.025);
      ctx.fillStyle = p.cloud; ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.ellipse(x, cy, r * 2.2, r * 0.7, 0, 0, TAU);
      ctx.ellipse(x - r, cy - r * 0.3, r, r * 0.8, 0, 0, TAU);
      ctx.ellipse(x + r * 0.6, cy - r * 0.5, r * 1.1, r * 0.9, 0, 0, TAU);
      ctx.fill(); ctx.globalAlpha = 1;
    }
  }

  // two ridges, the far one hazier; underwater they are rocks on the sea floor
  const ridge = (colour: string, base: number, amp: number, seed: number): void => {
    ctx.fillStyle = colour;
    ctx.beginPath(); ctx.moveTo(0, h);
    for (let x = 0; x <= w + 8; x += 8) {
      const a = v.yaw + (x - w / 2) / v.f;
      ctx.lineTo(x, hz - base - ridgeHeight(a, seed, amp) * v.f * 0.05);
    }
    ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
  };
  ridge(p.far, v.f * 0.07, 1.2, 1);
  if (p.treeline) {
    // the edge of a forest far away: a row of crowns along the near ridge
    ctx.fillStyle = p.treeline;
    for (let x = -10; x <= w + 10; x += 7) {
      const a = v.yaw + (x - w / 2) / v.f;
      const base = hz - v.f * 0.025 - ridgeHeight(a, 4, 0.7) * v.f * 0.05;
      const k = Math.sin(a * 211) * 0.5 + 0.5;
      const th = v.f * (0.018 + k * 0.022);
      ctx.beginPath(); ctx.moveTo(x - 6, base + 2); ctx.lineTo(x, base - th); ctx.lineTo(x + 6, base + 2); ctx.closePath(); ctx.fill();
    }
  }
  ridge(p.mid, v.f * 0.025, 0.7, 4);

  // the ground, from the horizon to your feet
  const gy = hz;
  const gg = ctx.createLinearGradient(0, gy, 0, h);
  gg.addColorStop(0, p.ground); gg.addColorStop(1, p.groundNear);
  ctx.fillStyle = gg;
  ctx.fillRect(0, gy, w, h - gy);
  // a soft band of haze where the land meets the sky, so the horizon is far away, not a line
  const hb = ctx.createLinearGradient(0, gy - v.f * 0.05, 0, gy + v.f * 0.04);
  hb.addColorStop(0, hexA(p.haze, 0));
  hb.addColorStop(0.55, hexA(p.haze, 0.55));
  hb.addColorStop(1, hexA(p.haze, 0));
  ctx.fillStyle = hb;
  ctx.fillRect(0, gy - v.f * 0.05, w, v.f * 0.09);

  // Patches on the ground, lying in perspective: the thing that makes the floor read as a floor
  // going away from you instead of a coloured sheet. They sit at fixed places in the world, so
  // they slide past as you turn, fast close by and slow far off.
  const patch = p.water ? 'rgba(255, 245, 210, 0.07)' : 'rgba(0, 0, 0, 0.045)';
  const light = p.water ? 'rgba(255, 255, 240, 0.06)' : 'rgba(255, 255, 255, 0.06)';
  for (const d of [2.2, 3, 4, 5.5, 7.5, 10, 14, 20, 30]) {
    const n = Math.round(d * 9);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + d * 1.3;
      const off = wrapAngle(a - v.yaw);
      if (Math.abs(off) > fovOf(v) / 2 + 0.2) continue;
      const sx = w / 2 + off * v.f, s = v.f / d, sy = hz + EYE * s;
      if (sy > h + 20) continue;
      const k = Math.sin(i * 12.9898 + d) * 0.5 + 0.5;
      ctx.fillStyle = k > 0.5 ? patch : light;
      ctx.beginPath(); ctx.ellipse(sx, sy, s * (0.08 + k * 0.16), s * (0.015 + k * 0.02), 0, 0, TAU); ctx.fill();
    }
  }
  if (p.water) {
    // light from the waves, wobbling across the sand
    ctx.strokeStyle = 'rgba(220, 250, 255, 0.10)';
    ctx.lineWidth = 2;
    for (let k = 0; k < 14; k++) {
      const y = hz + (h - hz) * (k / 14) ** 1.6 + 6;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 12) {
        const a = v.yaw + (x - w / 2) / v.f;
        const yy = y + Math.sin(a * 9 + t * 1.3 + k) * (3 + k) + Math.sin(a * 23 - t * 0.9) * 2;
        if (x) ctx.lineTo(x, yy); else ctx.moveTo(x, yy);
      }
      ctx.stroke();
    }
  }
}

/**
 * Sunlight coming down through the air in shafts, in the forest through gaps in the canopy. Drawn
 * last, over everything, and only when the sun is in view.
 */
export function drawShafts(ctx: Ctx, v: View, p: Palette, t: number): void {
  const sx = screenX(v, p.sunAt);
  if (sx < -v.w || sx > v.w * 2) return;
  const sy = v.horizon * (1 - p.sunUp * 0.9);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 6; i++) {
    const spread = (i - 2.5) * 0.18 + Math.sin(t * 0.2 + i) * 0.02;
    const len = v.h * 1.3;
    const ex = sx + Math.sin(spread + 0.25) * len, ey = sy + Math.cos(spread + 0.25) * len;
    const g = ctx.createLinearGradient(sx, sy, ex, ey);
    g.addColorStop(0, 'rgba(255, 240, 190, 0.10)');
    g.addColorStop(1, 'rgba(255, 240, 190, 0)');
    ctx.fillStyle = g;
    const wdt = 18 + i * 6;
    ctx.beginPath(); ctx.moveTo(sx - 4, sy); ctx.lineTo(sx + 4, sy); ctx.lineTo(ex + wdt, ey); ctx.lineTo(ex - wdt, ey); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- props

export type PropKind = 'fern' | 'cycad' | 'conifer' | 'rock' | 'drift' | 'tuft' | 'weed' | 'shell' | 'hedge' | 'tree' | 'shed' | 'flower' | 'palm';

export interface Prop { kind: PropKind; x: number; z: number; size: number; seed: number }

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = Math.imul(a ^ (a >>> 15), a | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Scatter props in rings around the camera, keeping a clear space in front where the story
 * happens (`keep` radians either side of straight ahead, closer than `keepDist` metres).
 */
export function scatter(seed: number, kinds: Array<[PropKind, number, number]>, keep = 0.5, keepDist = 20): Prop[] {
  const r = rng(seed);
  const out: Prop[] = [];
  for (const [kind, count, size] of kinds) {
    for (let i = 0; i < count; i++) {
      const a = r() * TAU, d = 4 + Math.pow(r(), 0.7) * 60;
      if (Math.abs(wrapAngle(a)) < keep && d < keepDist) continue;
      out.push({ kind, x: Math.sin(a) * d, z: Math.cos(a) * d, size: size * (0.7 + r() * 0.6), seed: r() * 1000 });
    }
  }
  return out;
}

/**
 * Small things close by, all the way round: grass, a fern at your elbow, a pebble. Without them
 * the ground between you and the horizon is an empty sheet, and it is the near things, big and
 * sliding fast as you turn, that make a flat picture feel like somewhere you are standing.
 */
export function near(seed: number, kinds: Array<[PropKind, number, number]>): Prop[] {
  const r = rng(seed);
  const out: Prop[] = [];
  for (const [kind, count, size] of kinds) {
    for (let i = 0; i < count; i++) {
      const a = r() * TAU, d = 1.6 + r() * 4.5;
      // in front, only the outer edges, so the story's middle stays clear
      if (Math.abs(wrapAngle(a)) < 0.3) continue;
      out.push({ kind, x: Math.sin(a) * d, z: Math.cos(a) * d, size: size * (0.6 + r() * 0.6), seed: r() * 1000 });
    }
  }
  return out;
}

function haze(colour: string, hazeColour: string, dist: number): string {
  const k = Math.min(0.85, Math.max(0, (dist - 8) / 70));
  const a = parseInt(colour.slice(1), 16), b = parseInt(hazeColour.slice(1), 16);
  const ch = (s: number): number => Math.round(((a >> s) & 255) * (1 - k) + ((b >> s) & 255) * k);
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

/** Draw one prop standing at its spot. `t` for things that sway. */
export function drawProp(ctx: Ctx, v: View, p: Prop, pal: Palette, t: number): void {
  const sp = spot(v, p.x, p.z);
  if (!sp.on) return;
  const s = sp.s * p.size, x = sp.x, y = sp.y;
  const hz = (c: string): string => haze(c, pal.haze, sp.dist);
  const sway = Math.sin(t * 0.8 + p.seed) * 0.05;
  ctx.save();
  switch (p.kind) {
    case 'fern': {
      ctx.strokeStyle = hz('#4f7a36'); ctx.lineCap = 'round'; ctx.lineWidth = Math.max(1, s * 0.04);
      for (let i = 0; i < 7; i++) {
        const a = -Math.PI / 2 + (i - 3) * 0.32 + sway;
        const ex = x + Math.cos(a) * s * 0.9, ey = y + Math.sin(a) * s * 0.8;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + Math.cos(a) * s * 0.4, y - s * 0.6, ex, ey); ctx.stroke();
        for (let k = 1; k < 6; k++) {
          const f = k / 6, px = x + (ex - x) * f, py = y + (ey - y) * f - Math.sin(f * Math.PI) * s * 0.15;
          ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + s * 0.08, py + s * 0.05); ctx.moveTo(px, py); ctx.lineTo(px - s * 0.08, py + s * 0.05); ctx.stroke();
        }
      }
      break;
    }
    case 'cycad': case 'palm': {
      const tall = p.kind === 'palm' ? 4 : 1.2;
      ctx.fillStyle = hz('#6b5234');
      ctx.fillRect(x - s * 0.12, y - s * tall, s * 0.24, s * tall);
      ctx.strokeStyle = hz('#4d7a30'); ctx.lineWidth = Math.max(1, s * 0.07); ctx.lineCap = 'round';
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU + sway;
        ctx.beginPath(); ctx.moveTo(x, y - s * tall);
        ctx.quadraticCurveTo(x + Math.cos(a) * s * 0.8, y - s * tall - s * 0.5, x + Math.cos(a) * s * 1.4, y - s * tall + s * 0.3 * (1 + Math.abs(Math.sin(a))));
        ctx.stroke();
      }
      break;
    }
    case 'conifer': {
      ctx.fillStyle = hz('#5b4028');
      ctx.fillRect(x - s * 0.1, y - s * 1.2, s * 0.2, s * 1.2);
      ctx.fillStyle = hz('#355a3a');
      for (let k = 0; k < 4; k++) {
        const by = y - s * (0.8 + k * 1.3), bw = s * (1.3 - k * 0.25);
        ctx.beginPath(); ctx.moveTo(x - bw, by); ctx.lineTo(x + sway * s, by - s * 1.9); ctx.lineTo(x + bw, by); ctx.closePath(); ctx.fill();
      }
      break;
    }
    case 'tree': {
      ctx.fillStyle = hz('#6a4a2c');
      ctx.fillRect(x - s * 0.15, y - s * 2.2, s * 0.3, s * 2.2);
      ctx.fillStyle = hz('#4e8a3e');
      ctx.beginPath(); ctx.arc(x + sway * s, y - s * 3, s * 1.4, 0, TAU); ctx.arc(x - s * 0.9, y - s * 2.4, s * 0.9, 0, TAU); ctx.arc(x + s * 0.9, y - s * 2.5, s, 0, TAU); ctx.fill();
      break;
    }
    case 'hedge': {
      ctx.fillStyle = hz('#3f7a3a');
      ctx.beginPath(); ctx.roundRect(x - s * 2, y - s * 1.3, s * 4, s * 1.3, s * 0.5); ctx.fill();
      break;
    }
    case 'shed': {
      ctx.fillStyle = hz('#8a5a3a');
      ctx.fillRect(x - s * 1.6, y - s * 2.2, s * 3.2, s * 2.2);
      ctx.fillStyle = hz('#5a3a26');
      ctx.beginPath(); ctx.moveTo(x - s * 1.9, y - s * 2.1); ctx.lineTo(x, y - s * 3.2); ctx.lineTo(x + s * 1.9, y - s * 2.1); ctx.closePath(); ctx.fill();
      ctx.fillStyle = hz('#3a2618');
      ctx.fillRect(x - s * 0.45, y - s * 1.6, s * 0.9, s * 1.6);
      ctx.strokeStyle = hz('#6a4228'); ctx.lineWidth = Math.max(1, s * 0.03);
      for (let k = 1; k < 8; k++) { ctx.beginPath(); ctx.moveTo(x - s * 1.6 + k * s * 0.4, y - s * 2.2); ctx.lineTo(x - s * 1.6 + k * s * 0.4, y); ctx.stroke(); }
      break;
    }
    case 'rock': {
      ctx.fillStyle = hz('#8a8578');
      ctx.beginPath(); ctx.ellipse(x, y - s * 0.3, s * 0.8, s * 0.45, 0, Math.PI, 0); ctx.lineTo(x + s * 0.8, y); ctx.lineTo(x - s * 0.8, y); ctx.fill();
      ctx.fillStyle = hz('#a39e90');
      ctx.beginPath(); ctx.ellipse(x - s * 0.25, y - s * 0.55, s * 0.3, s * 0.12, -0.3, 0, TAU); ctx.fill();
      break;
    }
    case 'drift': {
      ctx.fillStyle = hz('#f7fafc');
      ctx.beginPath(); ctx.ellipse(x, y, s * 1.6, s * 0.5, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = hz('#d5e0ea');
      ctx.beginPath(); ctx.ellipse(x + s * 0.4, y, s * 1.0, s * 0.18, 0, Math.PI, 0); ctx.fill();
      break;
    }
    case 'tuft': {
      ctx.strokeStyle = hz('#5f8f40'); ctx.lineWidth = Math.max(1, s * 0.03);
      for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(x + (i - 2) * s * 0.05, y); ctx.lineTo(x + (i - 2) * s * 0.12 + sway * s, y - s * (0.3 + (i % 2) * 0.12)); ctx.stroke(); }
      break;
    }
    case 'flower': {
      ctx.strokeStyle = hz('#4f8a3a'); ctx.lineWidth = Math.max(1, s * 0.03);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + sway * s, y - s * 0.4); ctx.stroke();
      ctx.fillStyle = hz(['#e0453a', '#f7c531', '#f07ab0'][Math.floor(p.seed) % 3]);
      ctx.beginPath(); ctx.arc(x + sway * s, y - s * 0.42, s * 0.08, 0, TAU); ctx.fill();
      break;
    }
    case 'weed': {
      ctx.strokeStyle = hz('#3f7a52'); ctx.lineWidth = Math.max(1, s * 0.06); ctx.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        ctx.beginPath(); ctx.moveTo(x + (i - 1) * s * 0.15, y);
        for (let k = 1; k <= 6; k++) ctx.lineTo(x + (i - 1) * s * 0.15 + Math.sin(t * 1.2 + k * 0.7 + p.seed + i) * s * 0.12, y - k * s * 0.35);
        ctx.stroke();
      }
      break;
    }
    case 'shell': {
      ctx.fillStyle = hz('#e8d2b0');
      ctx.beginPath(); ctx.arc(x, y - s * 0.12, s * 0.16, Math.PI, 0); ctx.fill();
      break;
    }
  }
  ctx.restore();
}
