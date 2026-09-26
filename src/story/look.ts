/**
 * The camera of the story journey: you stand in the middle of a world and turn to look around.
 *
 * Two ways to turn, because a child uses whichever they find first. Drag a finger across the
 * screen, and the world turns with it. Or hold the phone up and turn round, and the world stays
 * where it is while the phone looks at a different part of it - which is the whole trick of the
 * thing feeling like a place rather than a picture. The phone's compass heading is read locally and
 * never stored or sent anywhere; iOS asks the parent's permission for it the first time, on the
 * first tap, and if they say no, dragging still works.
 *
 * The camera only turns, it never moves. A world that turns around you feels real on a phone held
 * at arm's length; one you walk through would need a thumbstick, and a four-year-old has no use for
 * one.
 */

export const TAU = Math.PI * 2;

/** An angle folded into -π..π, so "how far to my left" is always the short way round. */
export const wrapAngle = (a: number): number => {
  let x = (a + Math.PI) % TAU;
  if (x < 0) x += TAU;
  return x - Math.PI;
};

interface OrientationEventish { alpha: number | null; beta: number | null; gamma: number | null }

export class Look {
  /** where the camera faces, in radians; 0 is where the story wants you to look first */
  yaw = 0;
  /** the camera turns towards this, so drags and the compass both feel smooth */
  private target = 0;
  private dragX: number | null = null;
  private dragYaw = 0;
  private gyroBase: number | null = null;
  private gyroYaw: number | null = null;
  private asked = false;
  /** how much of the turning is the child's own; a scene can take the camera for a moment */
  private guided: number | null = null;

  constructor(private width: () => number, private fov: () => number) {
    if (typeof window !== 'undefined') {
      window.addEventListener('deviceorientation', e => this.onTilt(e as unknown as OrientationEventish));
    }
  }

  /** iOS only hands out the compass after a tap and a yes; everyone else gives it straight away. */
  askForTilt(): void {
    if (this.asked) return;
    this.asked = true;
    const D = (window as unknown as { DeviceOrientationEvent?: { requestPermission?: () => Promise<string> } }).DeviceOrientationEvent;
    if (D && typeof D.requestPermission === 'function') {
      D.requestPermission().catch(() => { /* no compass, dragging still works */ });
    }
  }

  private onTilt(e: OrientationEventish): void {
    if (e.alpha == null) return;
    // alpha grows as the phone turns anticlockwise seen from above, so looking right is minus
    const heading = (-e.alpha * Math.PI) / 180;
    if (this.gyroBase == null) this.gyroBase = heading - this.target;
    this.gyroYaw = heading - this.gyroBase;
  }

  down(x: number): void { this.dragX = x; this.dragYaw = this.target; }
  move(x: number): void {
    if (this.dragX == null) return;
    // a full screen-width of drag turns you by the field of view, so the world sticks to the finger
    this.target = this.dragYaw - ((x - this.dragX) / this.width()) * this.fov();
    if (this.gyroYaw != null && this.gyroBase != null) this.gyroBase += (this.gyroYaw - this.target);
  }
  up(): void { this.dragX = null; }
  get dragging(): boolean { return this.dragX != null; }

  /** Turn the camera to face an angle, gently, for a story beat that needs you to see something. */
  guide(to: number | null): void { this.guided = to; }

  /** Face straight ahead, at once: the start of a new scene. */
  reset(): void {
    this.yaw = this.target = 0;
    if (this.gyroYaw != null) this.gyroBase = (this.gyroBase ?? 0) + this.gyroYaw;
    this.gyroYaw = this.gyroYaw != null ? 0 : null;
    this.guided = null;
  }

  update(dt: number): void {
    if (this.guided != null) this.target = this.yaw + wrapAngle(this.guided - this.yaw);
    else if (this.gyroYaw != null && this.dragX == null) this.target = this.gyroYaw;
    const k = Math.min(1, dt * (this.guided != null ? 2.2 : 10));
    this.yaw += wrapAngle(this.target - this.yaw) * k;
  }
}
