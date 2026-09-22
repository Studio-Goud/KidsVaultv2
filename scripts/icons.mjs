/**
 * The app's own mark: the way into the wood.
 *
 * Every one of the seventeen pages used to install itself under the Cloudhopper icon - a plane
 * over an island with a runway - which told a parent that a collection of sixteen games was an air
 * traffic game. This draws the thing the app is named after instead: a bramble arch with the light
 * coming through it, and a path running out towards you.
 *
 * It is built for the small end first. At forty-eight pixels an icon is a silhouette and two
 * colours, so what has to survive is one bright arch inside a ring of leaves. Everything else -
 * the thorns, the veins, the berries, the trees standing in the light - is for the thousand pixel
 * version, and is written once so the two can never drift apart.
 *
 *   npm run icons
 *
 * The maskable file pulls the art in to three fifths, because Android crops a circle out of the
 * square and a leaf that reached the corner would lose its point.
 */
import { Resvg } from '@resvg/resvg-js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const C = 256;                                    // the middle of a 512 square
const at = (x, y) => `${(C + x).toFixed(1)} ${(C + y).toFixed(1)}`;

/** The way through: a pointed arch that runs off the foot of the frame rather than standing on it. */
const OW = 116, APEX = -215, SPRING = -75, FOOT = 450;
const MOUTH = `M ${at(-OW, FOOT)} L ${at(-OW, SPRING)} Q ${at(-OW + 9, -155)} ${at(0, APEX)} `
  + `Q ${at(OW - 9, -155)} ${at(OW, SPRING)} L ${at(OW, FOOT)} Z`;

/**
 * One bramble leaf, as path data in its own coordinates.
 *
 * The bitten edge is what separates a bramble from a laurel, so it is a run of alternating deep
 * and shallow scallops rather than a smooth oval - and it is computed rather than drawn by hand,
 * which is the only reason the six leaves can all be the same leaf at different sizes.
 */
const leafPath = (L, W, grow = 1) => {
  const pts = [`M ${(-L / 2).toFixed(1)} 0`];
  for (const dir of [-1, 1]) {
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      const bite = (i % 2 === 0 ? 0.8 : 1.04) * Math.sin(t * Math.PI) * W * dir * grow;
      pts.push(`L ${(-L / 2 + t * L).toFixed(1)} ${bite.toFixed(1)}`);
    }
  }
  return pts.join(' ') + ' Z';
};

const veins = (L, W) => {
  const out = [`M ${(-L / 2).toFixed(1)} 0 L ${(L * 0.44).toFixed(1)} 0`];
  for (const t of [0.38, 0.6]) {
    const px = -L / 2 + t * L, up = Math.sin(t * Math.PI) * W * 0.64;
    out.push(`M ${px.toFixed(1)} 0 L ${(px + L * 0.16).toFixed(1)} ${(-up).toFixed(1)}`);
    out.push(`M ${px.toFixed(1)} 0 L ${(px + L * 0.16).toFixed(1)} ${up.toFixed(1)}`);
  }
  return out.join(' ');
};

const leaf = (cx, cy, L, W, turn, light, dark) => `
  <g transform="translate(${at(cx, cy)}) rotate(${(turn * 180 / Math.PI).toFixed(1)})">
    <path d="${leafPath(L, W, 1.1)}" fill="${dark}"/>
    <path d="${leafPath(L, W)}" fill="${light}"/>
    <path d="${veins(L, W)}" stroke="${dark}" stroke-width="3.5" stroke-linecap="round" fill="none"/>
  </g>`;

/** One blackberry on its stalk. At the sizes that matter it is a dark full stop, and that is enough. */
const berry = (cx, cy, R) => {
  const rows = [[-0.52, 2], [0.1, 2], [0.62, 1]];
  const d = R * 0.42;
  const drupes = rows.flatMap(([ry, n]) =>
    Array.from({ length: n }, (_, i) => {
      const dx = (i - (n - 1) / 2) * d * 1.75, dy = ry * R;
      return `<circle cx="${dx.toFixed(1)}" cy="${dy.toFixed(1)}" r="${d.toFixed(1)}" fill="#5a2668"/>`
        + `<circle cx="${(dx - d * 0.2).toFixed(1)}" cy="${(dy - d * 0.22).toFixed(1)}" r="${(d * 0.52).toFixed(1)}" fill="#8c49a0"/>`;
    })).join('');
  return `
  <g transform="translate(${at(cx, cy)})">
    <path d="M 0 ${(-R * 1.9).toFixed(1)} L 0 ${(-R * 0.9).toFixed(1)}" stroke="#123f28" stroke-width="5" stroke-linecap="round"/>
    <path d="M ${(-R * 0.88).toFixed(1)} ${(-R * 0.5).toFixed(1)}
             Q ${(-R).toFixed(1)} ${(R * 0.55).toFixed(1)} 0 ${(R * 1.08).toFixed(1)}
             Q ${R.toFixed(1)} ${(R * 0.55).toFixed(1)} ${(R * 0.88).toFixed(1)} ${(-R * 0.5).toFixed(1)}
             Q ${(R * 0.5).toFixed(1)} ${(-R * 1.12).toFixed(1)} 0 ${(-R * 1.02).toFixed(1)}
             Q ${(-R * 0.5).toFixed(1)} ${(-R * 1.12).toFixed(1)} ${(-R * 0.88).toFixed(1)} ${(-R * 0.5).toFixed(1)} Z"
          fill="#2b1033"/>
    ${drupes}
  </g>`;
};

/** One bough, and the thorns a bramble is named for. Drawn once; the arch mirrors it. */
const BOUGH = `
  <path d="M ${at(-215, 310)} Q ${at(-195, 30)} ${at(-125, -150)} Q ${at(-85, -250)} ${at(30, -270)}"
        stroke="#123f28" stroke-width="52" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  ${[[-212, 190, 0.25], [-200, 60, 0.5], [-157, -80, 1.0], [-95, -210, 1.8]].map(([tx, ty, a]) => `
  <g transform="translate(${at(tx, ty)}) rotate(${((Math.PI - a) * 180 / Math.PI).toFixed(1)})">
    <path d="M 0 0 L 52 -14 L 11 16 Z" fill="#123f28"/>
  </g>`).join('')}`;

const SPRIG = `
  ${leaf(-175, -184, 150, 53, -0.5, '#79c545', '#2f6b2a')}
  ${leaf(-210, -20, 134, 48, 0.3, '#5da634', '#2a6026')}
  ${leaf(-80, -260, 126, 46, -0.12, '#8bd155', '#3d7f2f')}
  ${berry(-148, -107, 37)}
  ${berry(-212, 107, 31)}`;

/** Everything that has a left and a right: drawn once, then flipped about the middle. */
const bothSides = (body) => `${body}
  <g transform="translate(512 0) scale(-1 1)">${body}</g>`;

/**
 * One drawing, four framings.
 *
 *   full        the square as it is, for the web and for iOS, which rounds its own corners
 *   maskable    pulled in, because Android crops a circle out of a PWA icon
 *   foreground  the art alone on nothing, for an adaptive launcher icon whose background is a
 *               flat colour underneath it, and whose safe zone is the middle two thirds
 *   round       the square cut to a circle, for the launchers that still ask for one
 */
const svg = (mode) => {
  const pull = mode === 'maskable' ? 0.60 : mode === 'foreground' ? 0.52 : 0.78;
  const ground = mode === 'foreground'
    ? ''
    : `<rect width="512" height="512" fill="url(#wood)"/>`;
  const cut = mode === 'round'
    ? `<clipPath id="disc"><circle cx="256" cy="256" r="256"/></clipPath>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="wood" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#16402c"/><stop offset="0.6" stop-color="#1b5134"/><stop offset="1" stop-color="#0d2a1d"/>
    </linearGradient>
    <linearGradient id="through" x1="0" y1="${C + APEX}" x2="0" y2="${C + 260}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#fff6cd"/><stop offset="0.4" stop-color="#e2f2a6"/><stop offset="1" stop-color="#6fb85c"/>
    </linearGradient>
    <clipPath id="inside"><path d="${MOUTH}"/></clipPath>
    ${cut}
  </defs>
  <g ${mode === 'round' ? 'clip-path="url(#disc)"' : ''}>
  ${ground}
  <g transform="translate(${C} ${C}) scale(${pull}) translate(${-C} ${-C})">
    <path d="${MOUTH}" fill="url(#through)"/>
    <g clip-path="url(#inside)">
      ${[[-75, 150, 54], [-15, 200, 66], [55, 140, 48], [98, 175, 58]].map(([tx, h, w]) =>
    `<path d="M ${at(tx - w / 2, 150)} L ${at(tx, 150 - h)} L ${at(tx + w / 2, 150)} Z" fill="#347c4c" opacity="0.3"/>`).join('')}
      <path d="M ${at(-22, 90)} L ${at(22, 90)} L ${at(107, FOOT)} L ${at(-107, FOOT)} Z" fill="#fff6cd" opacity="0.42"/>
    </g>
    <path d="${MOUTH}" fill="none" stroke="#fff0be" stroke-opacity="0.5" stroke-width="13" stroke-linejoin="round"/>
    ${bothSides(BOUGH)}
    ${bothSides(SPRIG)}
  </g>
  </g>
</svg>`;
};

const out = (path, size, mode = 'full') => {
  const r = new Resvg(svg(mode), { fitTo: { mode: 'width', value: size } });
  const png = r.render().asPng();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, png);
  console.log(`${path.padEnd(62)} ${String(size).padStart(4)}px  ${(png.length / 1024).toFixed(1)} kB`);
};

// ---- the web app
out('public/icons/icon-1024.png', 1024);
out('public/icons/icon-512.png', 512);
out('public/icons/icon-512-maskable.png', 512, 'maskable');
out('public/icons/icon-192.png', 192);
out('public/icons/apple-touch-icon.png', 180);

// ---- iOS, which wants one square and rounds it itself. It was shipping the Capacitor logo.
out('ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png', 1024);

// ---- Android. The adaptive pair is what a modern launcher uses: a flat colour underneath and
// the art on nothing above it, with room to be cropped to whatever shape the phone prefers. The
// two legacy files are for the launchers that never learnt.
const ANDROID = 'android/app/src/main/res';
for (const [dpi, legacy, fore] of [
  ['mdpi', 48, 108], ['hdpi', 72, 162], ['xhdpi', 96, 216], ['xxhdpi', 144, 324], ['xxxhdpi', 192, 432],
]) {
  out(`${ANDROID}/mipmap-${dpi}/ic_launcher.png`, legacy);
  out(`${ANDROID}/mipmap-${dpi}/ic_launcher_round.png`, legacy, 'round');
  out(`${ANDROID}/mipmap-${dpi}/ic_launcher_foreground.png`, fore, 'foreground');
}

// and the colour behind that foreground, which was still Cloudhopper's sky blue
writeFileSync(`${ANDROID}/values/ic_launcher_background.xml`,
  `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#1B5134</color>\n</resources>\n`);
console.log(`${(ANDROID + '/values/ic_launcher_background.xml').padEnd(62)}        #1B5134`);
