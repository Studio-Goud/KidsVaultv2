/**
 * Nine drawn animals, one for each shelf of the book, and one drawn child.
 *
 * They do three jobs. They are the picture on the category tile, so the shelves are pictures
 * rather than nine words in a row. They stand in for a photograph that has not arrived or will not
 * arrive, so the grid never has a hole in it. And on the detail page the animal and the child are
 * drawn on one scale, which is the whole point of the size bar: a number in centimetres means
 * nothing at six, and a shape next to your own shape means everything.
 *
 * Each one is drawn inside a hundred by hundred box and the caller places it. They are
 * silhouettes on purpose - a flat shape reads at thumbnail size and never competes with the real
 * photograph next to it.
 */

type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

/**
 * How tall each shape is for its own length, as it is drawn: one for the shapes that fill their
 * hundred by hundred box, and a good deal less for the ones that are mostly length. A whale drawn
 * as tall as it is long is not a whale, it is a barrage balloon - and on the size bar, where the
 * whole point is that the number is true, that matters.
 */
export const ASPECT: Record<string, number> = {
  mam: 1, bir: 1, fis: 1, rep: 1, amp: 1, but: 1, ins: 1, spi: 1, sea: 1, whale: 0.34, seal: 0.5,
};

/** Run a drawing inside a box of the given width and height, from the box it was drawn in. */
export function inBox(ctx: Ctx, x: number, y: number, w: number, h: number, draw: (c: Ctx) => void, tall = 100): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(w / 100, h / tall);
  draw(ctx);
  ctx.restore();
}

const leg = (ctx: Ctx, x: number, top: number, bottom: number, wide: number): void => {
  ctx.beginPath();
  ctx.roundRect(x - wide / 2, top, wide, bottom - top, wide * 0.5);
  ctx.fill();
};

/** A deer-ish four legged animal, facing right. */
function mammal(ctx: Ctx): void {
  // tail
  ctx.beginPath();
  ctx.moveTo(28, 44);
  ctx.quadraticCurveTo(14, 36, 8, 22);
  ctx.quadraticCurveTo(20, 31, 33, 41);
  ctx.closePath();
  ctx.fill();
  // legs, drawn first so the body sits over the top of them
  for (const x of [33, 44, 62, 73]) leg(ctx, x, 54, 90, 8);
  // body
  ctx.beginPath();
  ctx.ellipse(52, 48, 28, 17, 0, 0, TAU);
  ctx.fill();
  // neck: a wedge from the shoulder up to the head, wide enough to read as one animal
  ctx.beginPath();
  ctx.moveTo(63, 36);
  ctx.quadraticCurveTo(74, 35, 79, 23);
  ctx.lineTo(90, 27);
  ctx.quadraticCurveTo(84, 44, 70, 53);
  ctx.closePath();
  ctx.fill();
  // ears, leaning back off the top of the head - rounded, because a triangle on a mammal reads
  // as a horn and this one has to stand in for a fox, a mouse and a bear as well as a deer
  for (const [ex, ey, a] of [[79, 20, -0.4], [87, 18, -0.15]] as const) {
    ctx.save();
    ctx.translate(ex, ey);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.ellipse(0, -3.5, 3.2, 6, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  // head
  ctx.beginPath();
  ctx.ellipse(84, 28, 10, 8.5, -0.2, 0, TAU);
  ctx.fill();
  // muzzle
  ctx.beginPath();
  ctx.moveTo(88, 22);
  ctx.quadraticCurveTo(100, 24, 99, 31);
  ctx.quadraticCurveTo(93, 35, 86, 34);
  ctx.closePath();
  ctx.fill();
}

/** A perched bird, facing right. */
function bird(ctx: Ctx): void {
  // tail
  ctx.beginPath();
  ctx.moveTo(30, 52);
  ctx.lineTo(4, 70);
  ctx.lineTo(10, 74);
  ctx.lineTo(34, 62);
  ctx.closePath();
  ctx.fill();
  // legs
  for (const x of [52, 61]) leg(ctx, x, 66, 88, 4.5);
  ctx.beginPath();
  ctx.roundRect(46, 86, 22, 5, 2.5);
  ctx.fill();
  // body
  ctx.beginPath();
  ctx.ellipse(54, 50, 26, 19, -0.22, 0, TAU);
  ctx.fill();
  // wing
  ctx.save();
  ctx.globalAlpha *= 0.55;
  ctx.beginPath();
  ctx.ellipse(50, 50, 17, 9, -0.2, 0, TAU);
  ctx.fill();
  ctx.restore();
  // head
  ctx.beginPath();
  ctx.arc(76, 28, 12, 0, TAU);
  ctx.fill();
  // beak
  ctx.beginPath();
  ctx.moveTo(85, 23);
  ctx.lineTo(100, 29);
  ctx.lineTo(85, 34);
  ctx.closePath();
  ctx.fill();
}

/** A fish with a shark's dorsal fin, facing right. */
function fish(ctx: Ctx): void {
  // tail
  ctx.beginPath();
  ctx.moveTo(20, 50);
  ctx.lineTo(2, 30);
  ctx.lineTo(6, 50);
  ctx.lineTo(2, 72);
  ctx.closePath();
  ctx.fill();
  // body
  ctx.beginPath();
  ctx.moveTo(16, 50);
  ctx.quadraticCurveTo(40, 22, 74, 34);
  ctx.quadraticCurveTo(94, 42, 97, 52);
  ctx.quadraticCurveTo(88, 68, 62, 70);
  ctx.quadraticCurveTo(34, 72, 16, 50);
  ctx.closePath();
  ctx.fill();
  // dorsal fin
  ctx.beginPath();
  ctx.moveTo(44, 28);
  ctx.lineTo(52, 6);
  ctx.lineTo(68, 32);
  ctx.closePath();
  ctx.fill();
  // lower fin
  ctx.beginPath();
  ctx.moveTo(48, 66);
  ctx.lineTo(44, 84);
  ctx.lineTo(64, 68);
  ctx.closePath();
  ctx.fill();
}

/** A lizard seen from above. */
function reptile(ctx: Ctx): void {
  // tail, long and tapering, which is most of what says lizard rather than beetle
  ctx.beginPath();
  ctx.moveTo(30, 44);
  ctx.quadraticCurveTo(10, 40, 3, 64);
  ctx.quadraticCurveTo(9, 74, 12, 63);
  ctx.quadraticCurveTo(15, 49, 32, 55);
  ctx.closePath();
  ctx.fill();
  // four stubby limbs with a foot on the end, drawn under the body
  for (const [lx, ly, a] of [[41, 43, -2.3], [41, 57, 2.3], [63, 43, -0.85], [63, 57, 0.85]] as const) {
    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.roundRect(0, -4.5, 17, 9, 4.5);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(18, 0, 5, 5.5, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  // body
  ctx.beginPath();
  ctx.ellipse(50, 50, 24, 12, 0, 0, TAU);
  ctx.fill();
  // neck and a snout that comes to a point
  ctx.beginPath();
  ctx.moveTo(66, 42);
  ctx.quadraticCurveTo(82, 39, 96, 48);
  ctx.quadraticCurveTo(82, 58, 66, 55);
  ctx.closePath();
  ctx.fill();
}

/** A frog seen from the front. */
function amphibian(ctx: Ctx): void {
  // back legs
  for (const s of [-1, 1]) {
    ctx.save();
    ctx.translate(50, 62);
    ctx.scale(s, 1);
    ctx.beginPath();
    ctx.moveTo(16, -8);
    ctx.quadraticCurveTo(44, 0, 40, 22);
    ctx.quadraticCurveTo(36, 34, 22, 30);
    ctx.quadraticCurveTo(34, 20, 22, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  // body
  ctx.beginPath();
  ctx.ellipse(50, 56, 30, 24, 0, 0, TAU);
  ctx.fill();
  // front legs
  for (const s of [-1, 1]) {
    ctx.save();
    ctx.translate(50, 68);
    ctx.scale(s, 1);
    ctx.beginPath();
    ctx.roundRect(10, 0, 8, 22, 4);
    ctx.fill();
    ctx.restore();
  }
  // head and the two eyes on top
  ctx.beginPath();
  ctx.ellipse(50, 36, 24, 17, 0, 0, TAU);
  ctx.fill();
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(50 + s * 14, 22, 10, 0, TAU);
    ctx.fill();
  }
}

/** A butterfly with its wings open. */
function butterfly(ctx: Ctx): void {
  for (const s of [-1, 1]) {
    ctx.save();
    ctx.translate(50, 50);
    ctx.scale(s, 1);
    // upper wing
    ctx.beginPath();
    ctx.moveTo(2, -8);
    ctx.quadraticCurveTo(22, -46, 44, -38);
    ctx.quadraticCurveTo(52, -20, 32, 0);
    ctx.quadraticCurveTo(16, 4, 2, -8);
    ctx.closePath();
    ctx.fill();
    // lower wing
    ctx.beginPath();
    ctx.moveTo(3, 2);
    ctx.quadraticCurveTo(28, 2, 36, 18);
    ctx.quadraticCurveTo(40, 36, 22, 38);
    ctx.quadraticCurveTo(6, 34, 3, 12);
    ctx.closePath();
    ctx.fill();
    // antenna
    ctx.lineWidth = 3;
    ctx.strokeStyle = ctx.fillStyle;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(3, -16);
    ctx.quadraticCurveTo(12, -32, 22, -38);
    ctx.stroke();
    ctx.restore();
  }
  // body
  ctx.beginPath();
  ctx.ellipse(50, 50, 5, 26, 0, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(50, 28, 6, 0, TAU);
  ctx.fill();
}

/** A beetle seen from above. */
function insect(ctx: Ctx): void {
  // legs
  for (const s of [-1, 1]) {
    for (const [y, a] of [[38, -0.6], [52, 0], [66, 0.6]] as const) {
      ctx.save();
      ctx.translate(50, y);
      ctx.scale(s, 1);
      ctx.rotate(a);
      ctx.beginPath();
      ctx.roundRect(14, -3, 28, 6, 3);
      ctx.fill();
      ctx.restore();
    }
  }
  // antennae
  ctx.lineWidth = 4;
  ctx.strokeStyle = ctx.fillStyle;
  ctx.lineCap = 'round';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(50 + s * 5, 22);
    ctx.quadraticCurveTo(50 + s * 18, 12, 50 + s * 22, 2);
    ctx.stroke();
  }
  // head, thorax, wing cases
  ctx.beginPath();
  ctx.ellipse(50, 22, 12, 9, 0, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(50, 36, 17, 11, 0, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(50, 62, 23, 26, 0, 0, TAU);
  ctx.fill();
  ctx.save();
  ctx.globalAlpha *= 0.45;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(48.6, 38, 2.8, 48);
  ctx.restore();
}

/** A spider seen from above. */
function spider(ctx: Ctx): void {
  ctx.lineWidth = 5;
  ctx.strokeStyle = ctx.fillStyle;
  ctx.lineCap = 'round';
  for (const s of [-1, 1]) {
    for (const [dy, out, drop] of [[-16, 40, -18], [-5, 46, -2], [6, 46, 14], [16, 40, 30]] as const) {
      ctx.beginPath();
      ctx.moveTo(50 + s * 8, 46 + dy);
      ctx.quadraticCurveTo(50 + s * out, 46 + dy - 14, 50 + s * (out + 4), 46 + drop);
      ctx.stroke();
    }
  }
  ctx.beginPath();
  ctx.ellipse(50, 34, 12, 11, 0, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(50, 60, 19, 22, 0, 0, TAU);
  ctx.fill();
}

/** An octopus, which stands for everything that lives in the sea without a backbone. */
function seaCreature(ctx: Ctx): void {
  // arms
  for (let i = 0; i < 6; i++) {
    const s = i < 3 ? -1 : 1;
    const k = (i % 3) - 1;
    ctx.beginPath();
    ctx.moveTo(50 + s * 6, 58);
    ctx.quadraticCurveTo(50 + s * (22 + k * 8), 74 + k * 4, 50 + s * (34 + k * 12), 92 - Math.abs(k) * 12);
    ctx.quadraticCurveTo(50 + s * (24 + k * 8), 84 + k * 2, 50 + s * 2, 62);
    ctx.closePath();
    ctx.fill();
  }
  // mantle
  ctx.beginPath();
  ctx.moveTo(22, 52);
  ctx.quadraticCurveTo(20, 12, 50, 12);
  ctx.quadraticCurveTo(80, 12, 78, 52);
  ctx.quadraticCurveTo(64, 66, 50, 66);
  ctx.quadraticCurveTo(36, 66, 22, 52);
  ctx.closePath();
  ctx.fill();
  // eyes, knocked out of the silhouette
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(50 + s * 14, 40, 6, 7, 0, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/** A whale, drawn in a box a hundred long and thirty-four deep, because that is a whale. */
function whale(ctx: Ctx): void {
  // flukes
  ctx.beginPath();
  ctx.moveTo(19, 17); ctx.lineTo(2, 3); ctx.lineTo(8, 17); ctx.lineTo(2, 32);
  ctx.closePath();
  ctx.fill();
  // body
  ctx.beginPath();
  ctx.moveTo(10, 17);
  ctx.quadraticCurveTo(40, 2, 76, 8);
  ctx.quadraticCurveTo(96, 12, 98, 19);
  ctx.quadraticCurveTo(88, 29, 60, 30);
  ctx.quadraticCurveTo(30, 31, 10, 17);
  ctx.closePath();
  ctx.fill();
  // dorsal fin
  ctx.beginPath();
  ctx.moveTo(33, 7); ctx.quadraticCurveTo(38, -2, 45, 8);
  ctx.closePath();
  ctx.fill();
  // pectoral fin
  ctx.beginPath();
  ctx.moveTo(63, 24);
  ctx.quadraticCurveTo(58, 35, 46, 34);
  ctx.quadraticCurveTo(54, 28, 59, 22);
  ctx.closePath();
  ctx.fill();
}

/** A seal hauled out on a rock, for the ones that swim but come ashore. */
function seal(ctx: Ctx): void {
  ctx.beginPath();
  ctx.moveTo(22, 34); ctx.lineTo(3, 21); ctx.lineTo(9, 34); ctx.lineTo(2, 47);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(14, 33);
  ctx.quadraticCurveTo(34, 18, 62, 16);
  ctx.quadraticCurveTo(74, 14, 80, 7);
  ctx.quadraticCurveTo(93, 3, 96, 14);
  ctx.quadraticCurveTo(98, 22, 88, 24);
  ctx.quadraticCurveTo(70, 30, 56, 38);
  ctx.quadraticCurveTo(34, 47, 14, 33);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(57, 30);
  ctx.quadraticCurveTo(48, 45, 35, 47);
  ctx.quadraticCurveTo(44, 37, 49, 28);
  ctx.closePath();
  ctx.fill();
}

const SHAPES: Record<string, (c: Ctx) => void> = {
  mam: mammal, bir: bird, fis: fish, rep: reptile, amp: amphibian,
  but: butterfly, ins: insect, spi: spider, sea: seaCreature,
  whale, seal,
};

/** Draw a shape to exactly fill the given box, in the given colour. */
export function creature(ctx: Ctx, id: string, x: number, y: number, w: number, h: number, colour: string, alpha = 1): void {
  const shape = SHAPES[id] ?? mammal;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = colour;
  inBox(ctx, x, y, w, h, shape, (ASPECT[id] ?? 1) * 100);
  ctx.restore();
}

/** Draw a shape as large as it fits inside the box without changing its proportions, centred. */
export function creatureFit(ctx: Ctx, id: string, x: number, y: number, w: number, h: number, colour: string, alpha = 1): void {
  const a = ASPECT[id] ?? 1;
  const dw = Math.min(w, h / a);
  const dh = dw * a;
  creature(ctx, id, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh, colour, alpha);
}

/**
 * A child, standing, drawn so the top of the head is at y and the feet at y + h. Everything on the
 * size bar is measured against this shape, so it is deliberately plain: a person, not a character.
 */
export function child(ctx: Ctx, x: number, y: number, h: number, colour: string): void {
  const u = h / 100;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = colour;
  // head
  ctx.beginPath();
  ctx.arc(0, 11 * u, 11 * u, 0, TAU);
  ctx.fill();
  // body
  ctx.beginPath();
  ctx.moveTo(-9 * u, 24 * u);
  ctx.quadraticCurveTo(0, 21 * u, 9 * u, 24 * u);
  ctx.lineTo(8 * u, 56 * u);
  ctx.lineTo(-8 * u, 56 * u);
  ctx.closePath();
  ctx.fill();
  // arms
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.roundRect(s * 8 * u - (s < 0 ? 6 * u : 0), 25 * u, 6 * u, 28 * u, 3 * u);
    ctx.fill();
  }
  // legs
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.roundRect(s * 7 * u - (s < 0 ? 0 : 7 * u), 54 * u, 7 * u, 46 * u, 3.4 * u);
    ctx.fill();
  }
  ctx.restore();
}
