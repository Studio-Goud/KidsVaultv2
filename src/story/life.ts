/**
 * Everything that lives in a scene besides the animal the story is about.
 *
 * A world with one animal in it is a stage set. A world where fish turn together over your head,
 * a dragonfly stops in the air beside you and something small and fast runs past between the
 * ferns is a place. None of it asks anything of the child; it is there so that turning round is
 * always worth it, because there is always something moving behind you.
 *
 * All of it is true to its time. In the chalk sea: fish, ammonites and jellyfish. In the forest
 * where the T. rex lived (the Hell Creek rocks of North America, about 68 to 66 million years ago):
 * dragonflies, Ornithomimus running on two legs, and Quetzalcoatlus, the giant pterosaur, overhead.
 * In the ice age: birds and blowing snow. In the garden: butterflies and birds.
 *
 * Each creature has a position in the same metres as everything else and is drawn through the
 * same perspective (`world.ts`), so it is sorted into the scene at its own distance: a dragonfly
 * close by passes in front of a fern, a runner far away passes behind one.
 */

import { TAU } from './look';
import { screenX, spot, type View } from './world';
import { drawPterosaur, drawRunner } from './beasts';

type Ctx = CanvasRenderingContext2D;
export type Place = 'garden' | 'ice' | 'sea' | 'forest';

/** Something to draw at a distance, for sorting in with the props. */
export interface Drawable { d: number; draw: () => void }

interface Critter {
  kind: 'fish' | 'ammonite' | 'jelly' | 'dragonfly' | 'butterfly' | 'runner';
  x: number; z: number; y: number;
  vx: number; vz: number;
  phase: number;
  seed: number;
  colour: string;
}

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = Math.imul(a ^ (a >>> 15), a | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export class Life {
  private critters: Critter[] = [];
  private t = 0;
  private runnerIn = 6;
  private r: () => number;

  constructor(private place: Place, seed: number) {
    this.r = rng(seed);
    const r = this.r;
    const around = (n: number, d0: number, d1: number, make: (x: number, z: number) => Critter): void => {
      for (let i = 0; i < n; i++) {
        const a = r() * TAU, d = d0 + r() * (d1 - d0);
        this.critters.push(make(Math.sin(a) * d, Math.cos(a) * d));
      }
    };
    if (place === 'sea') {
      // three schools of fish, each turning together, and a few loners
      for (let sch = 0; sch < 3; sch++) {
        const a = r() * TAU, d = 7 + r() * 10, cx = Math.sin(a) * d, cz = Math.cos(a) * d, cy = 1.5 + r() * 4;
        const colour = ['#e8c850', '#a8d8e8', '#f0a060'][sch];
        for (let i = 0; i < 14; i++) {
          this.critters.push({ kind: 'fish', x: cx + (r() - 0.5) * 3, z: cz + (r() - 0.5) * 3, y: cy + (r() - 0.5) * 1.5, vx: 0, vz: 0, phase: r() * TAU, seed: sch, colour });
        }
      }
      around(6, 6, 18, (x, z) => ({ kind: 'ammonite', x, z, y: 1 + r() * 4, vx: (r() - 0.5) * 0.3, vz: (r() - 0.5) * 0.3, phase: r() * TAU, seed: r(), colour: '#c89a6a' }));
      around(5, 5, 16, (x, z) => ({ kind: 'jelly', x, z, y: 2 + r() * 5, vx: 0, vz: 0, phase: r() * TAU, seed: r(), colour: 'rgba(230, 200, 255, 0.45)' }));
    } else if (place === 'forest') {
      around(5, 2.5, 7, (x, z) => ({ kind: 'dragonfly', x, z, y: 0.8 + r() * 1.2, vx: 0, vz: 0, phase: r() * TAU, seed: r(), colour: '#3aa0b0' }));
    } else if (place === 'garden') {
      around(4, 2, 6, (x, z) => ({ kind: 'butterfly', x, z, y: 0.5 + r() * 1, vx: 0, vz: 0, phase: r() * TAU, seed: r(), colour: ['#f0a030', '#ffffff', '#e05080', '#f7d040'][Math.floor(r() * 4)] }));
    }
  }

  update(dt: number): void {
    this.t += dt;
    const t = this.t;
    for (const c of this.critters) {
      c.phase += dt;
      if (c.kind === 'fish') {
        // each school circles round you, one school one way and the next the other, and every fish
        // wobbles on its own: from the middle it looks as if the sea is turning
        const cx = 0, cz = 0;
        const a = Math.atan2(c.x - cx, c.z - cz) + dt * (0.12 + c.seed * 0.03) * (c.seed % 2 ? 1 : -1);
        const d = Math.hypot(c.x - cx, c.z - cz);
        const nx = Math.sin(a) * d, nz = Math.cos(a) * d;
        c.vx = (nx - c.x) / dt; c.vz = (nz - c.z) / dt;
        c.x = nx; c.z = nz;
        c.y += Math.sin(t * 0.8 + c.phase) * dt * 0.2;
      } else if (c.kind === 'ammonite' || c.kind === 'jelly') {
        c.x += c.vx * dt; c.z += c.vz * dt;
        if (c.kind === 'jelly') c.y += (Math.sin(c.phase * 1.4) > 0.6 ? 0.25 : -0.05) * dt;
        if (c.y > 8) c.y = 1;
      } else if (c.kind === 'dragonfly' || c.kind === 'butterfly') {
        // a dart, a hover, a dart: the way a dragonfly actually flies
        const dart = c.kind === 'dragonfly' ? (Math.sin(c.phase * 0.9 + c.seed * 10) > 0.7 ? 3 : 0.1) : 0.6;
        const dir = Math.sin(c.phase * 0.3 + c.seed * 20) * TAU;
        c.x += Math.cos(dir) * dart * dt;
        c.z += Math.sin(dir) * dart * dt;
        const d = Math.hypot(c.x, c.z);
        if (d > 8 || d < 1.8) { c.x *= d > 8 ? 0.98 : 1.03; c.z *= d > 8 ? 0.98 : 1.03; }
        c.y = (c.kind === 'dragonfly' ? 1.2 : 0.8) + Math.sin(c.phase * 2.1 + c.seed) * 0.35;
      } else if (c.kind === 'runner') {
        c.x += c.vx * dt; c.z += c.vz * dt;
        c.phase += dt * 1.6;
      }
    }
    this.critters = this.critters.filter(c => c.kind !== 'runner' || Math.hypot(c.x, c.z) < 70);
    if (this.place === 'forest') {
      this.runnerIn -= dt;
      if (this.runnerIn <= 0) {
        // a small herd of Ornithomimus crossing, far off, in a straight line
        this.runnerIn = 14 + this.r() * 10;
        const a = this.r() * TAU, d = 22 + this.r() * 10;
        const hx = Math.cos(a + Math.PI / 2), hz = -Math.sin(a + Math.PI / 2);
        const n = 2 + Math.floor(this.r() * 3);
        for (let i = 0; i < n; i++) {
          const back = 40 + i * 2.5;
          this.critters.push({ kind: 'runner', x: Math.sin(a) * d - hx * back, z: Math.cos(a) * d - hz * back + i * 1.5, y: 0, vx: hx * 7, vz: hz * 7, phase: this.r(), seed: i, colour: '' });
        }
      }
    }
  }

  /** Things in the sky, drawn behind everything on the ground: birds, the pterosaur. */
  drawSky(ctx: Ctx, v: View, haze: string): void {
    const t = this.t;
    if (this.place === 'garden' || this.place === 'ice') {
      // a loose V of birds crossing slowly
      const a0 = t * 0.05 + (this.place === 'ice' ? 2 : 0.5);
      for (let i = 0; i < 7; i++) {
        const a = a0 - Math.abs(i - 3) * 0.04, elev = 0.35 + (i - 3) * 0.02 + Math.abs(i - 3) * 0.015;
        const x = screenX(v, a), y = v.horizon - elev * v.f;
        if (x < -20 || x > v.w + 20) continue;
        const flap = Math.sin(t * 8 + i) * 4;
        ctx.strokeStyle = this.place === 'ice' ? 'rgba(60, 70, 80, 0.7)' : 'rgba(40, 50, 60, 0.7)';
        ctx.lineWidth = 1.6; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x - 7, y - flap); ctx.quadraticCurveTo(x - 3, y - 2, x, y); ctx.quadraticCurveTo(x + 3, y - 2, x + 7, y - flap); ctx.stroke();
      }
    }
    if (this.place === 'forest') {
      // Quetzalcoatlus, gliding in a wide circle high over the trees
      const a = t * 0.04 + 1;
      const x = screenX(v, a), y = v.horizon - 0.42 * v.f + Math.sin(t * 0.3) * 10;
      if (x > -200 && x < v.w + 200) {
        drawPterosaur(ctx, x, y, v.f / 60, { facing: 1, phase: 0, t, haze, hazeK: 0.35 });
      }
    }
  }

  /** Everything at a distance, to be sorted in with the props and the story's animal. */
  items(ctx: Ctx, v: View, haze: string): Drawable[] {
    const out: Drawable[] = [];
    for (const c of this.critters) {
      const d = Math.hypot(c.x, c.z);
      out.push({ d, draw: () => this.drawCritter(ctx, v, c, haze) });
    }
    return out;
  }

  private drawCritter(ctx: Ctx, v: View, c: Critter, haze: string): void {
    const sp = spot(v, c.x, c.z, c.y);
    if (!sp.on) return;
    const s = sp.s;
    const t = this.t;
    // which way across the screen it is going, from where it will be a moment from now
    const ahead = spot(v, c.x + c.vx * 0.1, c.z + c.vz * 0.1, c.y);
    const face = ahead.x >= sp.x ? 1 : -1;
    ctx.save();
    ctx.translate(sp.x, sp.y);
    if (c.kind === 'fish') {
      const w = 0.35 * s, wig = Math.sin(t * 9 + c.phase * 3) * 0.3;
      ctx.scale(face, 1);
      ctx.fillStyle = c.colour;
      ctx.beginPath(); ctx.ellipse(0, 0, w, w * 0.35, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-w * 0.8, 0); ctx.lineTo(-w * 1.4, -w * 0.35 + wig * w * 0.3); ctx.lineTo(-w * 1.4, w * 0.35 + wig * w * 0.3); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(20,30,40,0.8)';
      ctx.beginPath(); ctx.arc(w * 0.55, -w * 0.05, Math.max(0.6, w * 0.07), 0, TAU); ctx.fill();
    } else if (c.kind === 'ammonite') {
      // a coiled shell with its tentacles trailing: the ammonites died out with the dinosaurs
      const r = 0.3 * s;
      ctx.scale(face, 1);
      ctx.fillStyle = c.colour;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(90, 60, 30, 0.7)'; ctx.lineWidth = Math.max(0.8, r * 0.12);
      ctx.beginPath();
      for (let k = 0; k < 40; k++) { const a = k * 0.35, rr = r * (1 - k / 44); const px = Math.cos(a) * rr, py = Math.sin(a) * rr; if (k) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
      ctx.stroke();
      ctx.strokeStyle = 'rgba(200, 140, 110, 0.7)';
      for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.moveTo(r * 0.9, (k - 2) * r * 0.12); ctx.quadraticCurveTo(r * 1.6, (k - 2) * r * 0.2 + Math.sin(t * 3 + k) * r * 0.1, r * 2, (k - 2) * r * 0.3); ctx.stroke(); }
    } else if (c.kind === 'jelly') {
      const r = 0.35 * s, pulse = 1 + Math.sin(c.phase * 3) * 0.12;
      ctx.fillStyle = c.colour;
      ctx.beginPath(); ctx.ellipse(0, 0, r * pulse, r * 0.7 / pulse, 0, Math.PI, 0); ctx.fill();
      ctx.strokeStyle = 'rgba(230, 210, 255, 0.4)'; ctx.lineWidth = Math.max(0.6, r * 0.05);
      for (let k = 0; k < 6; k++) { const x = (k - 2.5) * r * 0.3; ctx.beginPath(); ctx.moveTo(x, 0); ctx.quadraticCurveTo(x + Math.sin(t * 2 + k) * r * 0.3, r, x, r * 1.8); ctx.stroke(); }
    } else if (c.kind === 'dragonfly') {
      const len = 0.09 * s;
      ctx.scale(face, 1);
      ctx.fillStyle = c.colour;
      ctx.fillRect(-len, -len * 0.08, len * 2, len * 0.16);
      ctx.beginPath(); ctx.arc(len, 0, len * 0.15, 0, TAU); ctx.fill();
      const buzz = Math.sin(t * 60) * 0.4;
      ctx.fillStyle = 'rgba(220, 240, 255, 0.55)';
      for (const side of [-1, 1]) {
        ctx.beginPath(); ctx.ellipse(len * 0.2, side * len * 0.3 * (1 + buzz), len * 0.6, len * 0.18, side * 0.2, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.ellipse(len * 0.55, side * len * 0.28 * (1 - buzz), len * 0.5, len * 0.16, -side * 0.2, 0, TAU); ctx.fill();
      }
    } else if (c.kind === 'butterfly') {
      const r = 0.05 * s, open = Math.abs(Math.sin(t * 10 + c.phase));
      ctx.fillStyle = c.colour;
      ctx.beginPath(); ctx.ellipse(-r * open, 0, r * open, r * 1.2, 0.3, 0, TAU); ctx.ellipse(r * open, 0, r * open, r * 1.2, -0.3, 0, TAU); ctx.fill();
      ctx.fillStyle = '#2a2016'; ctx.fillRect(-r * 0.1, -r, r * 0.2, r * 2);
    } else if (c.kind === 'runner') {
      ctx.restore();
      drawRunner(ctx, sp.x, sp.y, s, { facing: face as -1 | 1, phase: c.phase, t, haze, hazeK: Math.min(0.6, sp.dist / 70) });
      return;
    }
    ctx.restore();
  }
}
