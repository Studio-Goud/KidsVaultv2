import type { Vec } from '../util/math';
import { dist } from '../util/math';
import { sfx } from '../util/audio';
import type { Plane } from './types';
import type { World } from './world';

interface Drag {
  plane: Plane;
  raw: Vec[];
  startScreen: Vec;
  moved: boolean;
  locked: boolean;
  prevPath: Vec[];
  prevLock: string | null;
}

export interface Camera {
  zoom: number;
  toWorld(sx: number, sy: number): Vec;
  zoomAt(sx: number, sy: number, factor: number): void;
  panBy(dx: number, dy: number): void;
  resetView(): void;
}

/**
 * One finger on an aircraft draws a route. One finger elsewhere pans when zoomed in.
 * Two fingers pinch-zoom and pan. Double tap toggles a 2x zoom on that spot.
 */
export class Input {
  private drags = new Map<number, Drag>();
  private pointers = new Map<number, Vec>();
  private pinch: { d: number; mid: Vec } | null = null;
  private panPointer: number | null = null;
  private lastPan: Vec | null = null;
  private lastTap = 0;
  private lastTapPos: Vec = { x: 0, y: 0 };
  enabled = true;

  constructor(
    private canvas: HTMLCanvasElement,
    private getWorld: () => World | null,
    private camera: Camera,
    private hudHit: (sx: number, sy: number) => boolean,
  ) {
    canvas.addEventListener('pointerdown', this.onDown, { passive: false });
    canvas.addEventListener('pointermove', this.onMove, { passive: false });
    canvas.addEventListener('pointerup', this.onUp, { passive: false });
    canvas.addEventListener('pointercancel', this.onUp, { passive: false });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('wheel', e => { e.preventDefault(); this.camera.zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.12 : 1 / 1.12); }, { passive: false });
  }

  private onDown = (e: PointerEvent): void => {
    e.preventDefault();
    sfx.unlock();
    if (!this.enabled) return;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { this.canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    // second finger: switch to pinch, drop any drawing in progress
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      this.pinch = { d: dist(a, b), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
      for (const d of this.drags.values()) { d.plane.path = d.prevPath; d.plane.lockedRunway = d.prevLock; }
      this.drags.clear(); this.panPointer = null;
      return;
    }
    const world = this.getWorld();
    if (!world || world.status !== 'running') return;
    if (this.hudHit(e.clientX, e.clientY)) return;
    const p = this.camera.toWorld(e.clientX, e.clientY);
    const plane = world.planeAt(p, 46 / Math.max(1, this.camera.zoom * 0.7));
    if (!plane) {
      // tap on empty map: deselect; a drag pans when zoomed in
      const now = performance.now();
      if (now - this.lastTap < 320 && dist(this.lastTapPos, { x: e.clientX, y: e.clientY }) < 30) {
        if (this.camera.zoom > 1.05) this.camera.resetView(); else this.camera.zoomAt(e.clientX, e.clientY, 2.2);
        this.lastTap = 0;
      } else { this.lastTap = now; this.lastTapPos = { x: e.clientX, y: e.clientY }; }
      world.select(null);
      this.panPointer = e.pointerId; this.lastPan = { x: e.clientX, y: e.clientY };
      return;
    }
    const drag: Drag = { plane, raw: [{ ...plane.pos }], startScreen: { x: e.clientX, y: e.clientY }, moved: false, locked: false, prevPath: plane.path.slice(), prevLock: plane.lockedRunway };
    this.drags.set(e.pointerId, drag);
    world.beginPath(plane);
    world.select(plane);
  };

  private onMove = (e: PointerEvent): void => {
    if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pinch && this.pointers.size >= 2) {
      e.preventDefault();
      const [a, b] = [...this.pointers.values()];
      const d = dist(a, b), mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      if (d > 0 && this.pinch.d > 0) this.camera.zoomAt(mid.x, mid.y, d / this.pinch.d);
      this.camera.panBy(mid.x - this.pinch.mid.x, mid.y - this.pinch.mid.y);
      this.pinch = { d, mid };
      return;
    }
    if (this.panPointer === e.pointerId && this.lastPan) {
      e.preventDefault();
      if (this.camera.zoom > 1.02) this.camera.panBy(e.clientX - this.lastPan.x, e.clientY - this.lastPan.y);
      this.lastPan = { x: e.clientX, y: e.clientY };
      return;
    }
    const drag = this.drags.get(e.pointerId);
    if (!drag) return;
    e.preventDefault();
    const world = this.getWorld();
    if (!world || drag.locked || drag.plane.state !== 'flying') return;
    if (!drag.moved && dist(drag.startScreen, { x: e.clientX, y: e.clientY }) > 9) drag.moved = true;
    if (!drag.moved) return;
    const p = this.camera.toWorld(e.clientX, e.clientY);
    const last = drag.raw[drag.raw.length - 1];
    if (dist(last, p) < 3) return;
    drag.raw.push(p);
    const locked = world.setPath(drag.plane, drag.raw);
    if (locked) { drag.locked = true; world.endPath(drag.plane); }
  };

  private onUp = (e: PointerEvent): void => {
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.pinch = null;
    if (this.panPointer === e.pointerId) { this.panPointer = null; this.lastPan = null; }
    const drag = this.drags.get(e.pointerId);
    if (!drag) return;
    this.drags.delete(e.pointerId);
    const world = this.getWorld();
    if (!world) return;
    if (!drag.moved) {
      drag.plane.path = drag.prevPath;
      drag.plane.lockedRunway = drag.prevLock;
      drag.plane.pathIndex = 0;
      return;
    }
    if (!drag.locked) world.endPath(drag.plane);
  };

  cancelAll(): void { this.drags.clear(); this.pinch = null; this.panPointer = null; this.pointers.clear(); }
}
