/**
 * A world map, drawn, with the continents an animal has actually been recorded on lit up.
 *
 * The shapes are coarse on purpose. This is not an atlas: it answers "is that near us, or far
 * away?" for a five year old, and for that the question is whether Africa is recognisably Africa
 * and whether it is south of us, not where the border of Chad runs. Every outline is a handful of
 * longitude and latitude points, laid out flat (equirectangular), which is the projection a child
 * has already seen on every classroom wall.
 *
 * Where each animal lives comes from GBIF: the continents it has really been recorded on, keeping
 * only those with at least a twelfth of the records of the busiest one, so a single escaped
 * parrot in a Dutch garden does not put a macaw in Europe.
 */

type Ctx = CanvasRenderingContext2D;

type Ring = ReadonlyArray<readonly [number, number]>;

const LAND: Record<string, Ring[]> = {
  na: [[
    [-168, 66], [-160, 71], [-140, 70], [-125, 70], [-110, 69], [-95, 70], [-85, 73], [-73, 79],
    [-58, 76], [-52, 68], [-62, 60], [-55, 52], [-66, 45], [-70, 42], [-76, 35], [-81, 25],
    [-85, 30], [-91, 29], [-97, 26], [-105, 22], [-110, 24], [-114, 31], [-122, 37], [-125, 45],
    [-130, 54], [-140, 60], [-152, 58], [-165, 55],
  ]],
  sa: [[
    [-81, 8], [-75, 11], [-66, 11], [-60, 8], [-51, 4], [-50, -1], [-44, -2], [-35, -6],
    [-38, -13], [-48, -25], [-53, -34], [-58, -39], [-62, -42], [-65, -50], [-68, -55],
    [-74, -52], [-73, -45], [-75, -35], [-71, -25], [-70, -18], [-76, -14], [-81, -6], [-80, 2],
  ]],
  af: [[
    [-17, 15], [-12, 24], [-6, 36], [10, 37], [20, 32], [32, 31], [35, 23], [43, 12], [51, 12],
    [48, 5], [41, -1], [40, -10], [35, -20], [33, -28], [25, -34], [18, -34], [12, -17],
    [9, -1], [9, 4], [-5, 5], [-8, 4], [-13, 9],
  ]],
  eu: [[
    [-10, 36], [-10, 44], [-2, 44], [-5, 49], [2, 51], [3, 58], [8, 58], [11, 55], [13, 55],
    [15, 60], [22, 60], [25, 65], [31, 70], [40, 68], [60, 68], [60, 50], [52, 47], [42, 44],
    [35, 42], [28, 41], [24, 36], [18, 40], [12, 38], [8, 44], [3, 42], [-3, 36],
  ]],
  as: [[
    [60, 68], [80, 73], [100, 77], [120, 73], [140, 72], [160, 70], [180, 66], [172, 60],
    [160, 60], [155, 50], [140, 46], [135, 35], [122, 31], [120, 22], [110, 20], [105, 10],
    [103, 1], [97, 6], [90, 22], [80, 9], [72, 20], [68, 24], [62, 25], [57, 25], [52, 29],
    [45, 40], [50, 45], [58, 50],
  ]],
  oc: [
    [
      [113, -22], [114, -34], [121, -34], [129, -32], [137, -35], [141, -38], [148, -38],
      [150, -35], [153, -28], [153, -25], [146, -19], [142, -11], [136, -12], [130, -11],
      [126, -14], [122, -18],
    ],
    [[166, -46], [170, -46], [174, -41], [178, -38], [175, -36], [172, -40], [168, -44]],
    [[141, -3], [150, -6], [147, -10], [138, -9], [132, -4]],
  ],
  an: [[
    [-180, -70], [-140, -74], [-100, -73], [-60, -64], [-20, -70], [20, -70], [60, -67],
    [100, -66], [140, -67], [180, -70], [180, -85], [-180, -85],
  ]],
};

export const CONTINENTS = Object.keys(LAND);

/**
 * The same outlines, for anything else that needs a world map.
 *
 * Wereldatlas puts the continents on a board and has children drag them into place, and the last
 * thing Suri needs is two different Africas in it. Nothing above changes: this hands out
 * the rings the animal book has always drawn, keyed by the same continent codes.
 */
export type LonLat = readonly [number, number];
export const CONTINENT_RINGS: Readonly<Record<string, ReadonlyArray<ReadonlyArray<LonLat>>>> = LAND;

const path = (ctx: Ctx, ring: Ring, x: number, y: number, w: number, h: number): void => {
  ctx.beginPath();
  ring.forEach(([lon, lat], i) => {
    const px = x + ((lon + 180) / 360) * w;
    const py = y + ((90 - lat) / 180) * h;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  });
  ctx.closePath();
};

/**
 * Draw the map. `lit` is the list of continent codes to pick out; everything else stays quiet, so
 * the eye lands on the answer without anything having to be labelled.
 */
export function worldMap(
  ctx: Ctx, x: number, y: number, w: number, h: number, lit: string[], tone: string,
): void {
  ctx.save();
  // the sea
  ctx.fillStyle = '#cfe6f2';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.min(w, h) * 0.06);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.min(w, h) * 0.06);
  ctx.clip();

  // the equator, so north and south are readable without a word
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = Math.max(1, h * 0.012);
  ctx.setLineDash([h * 0.05, h * 0.05]);
  ctx.beginPath();
  ctx.moveTo(x, y + h / 2);
  ctx.lineTo(x + w, y + h / 2);
  ctx.stroke();
  ctx.setLineDash([]);

  for (const [code, rings] of Object.entries(LAND)) {
    const on = lit.includes(code);
    for (const ring of rings) {
      path(ctx, ring, x, y, w, h);
      ctx.fillStyle = on ? tone : '#a9c6b4';
      ctx.globalAlpha = on ? 1 : 0.55;
      ctx.fill();
      if (on) {
        ctx.globalAlpha = 1;
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth = Math.max(1.2, h * 0.014);
        ctx.stroke();
      }
    }
  }
  ctx.restore();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(30, 70, 90, 0.22)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x + 0.75, y + 0.75, w - 1.5, h - 1.5, Math.min(w, h) * 0.06);
  ctx.stroke();
  ctx.restore();
}
