/**
 * The app's own mark: Suri.
 *
 * The app is named after the guide, so the icon is the guide. Not a scene and not a logotype: a
 * face, because a face is what a two-year-old finds on a home screen full of squares, and because
 * the thing this app sells is somebody who explains things to your child.
 *
 * It is built for the small end first. At forty-eight pixels an icon is a silhouette and two
 * tones, so what has to survive is exactly what makes him read in the app at thumb size: a round
 * sandy head, two dark patches over the eyes, a pointed snout, two round ears. Everything else -
 * the dusk behind him, the mound he is standing on, the pale chest - is for the thousand pixel
 * version.
 *
 * The geometry is a deliberate copy of `src/platform/guide.ts`, scaled up. If the drawing in the
 * app changes, this has to change with it, or the icon stops being the same animal.
 *
 *   npm run icons
 *
 * The maskable file pulls the art in, because Android crops a circle out of the square and an ear
 * that reached the corner would lose its tip.
 */
import { Resvg } from '@resvg/resvg-js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const C = 256;                                    // the middle of a 512 square
const at = (x, y) => `${(C + x).toFixed(1)} ${(C + y).toFixed(1)}`;

// the same palette the guide is drawn in, so the icon and the animal cannot drift apart
const FUR = '#d9a96a';
const FUR_D = '#b9884a';
const BELLY = '#f2dcb4';
const MASK = '#4a3524';
const NOSE = '#2e2119';
const EAR = '#6b4d32';
const SAND = '#e0b878';

/** Mirror a body of paths about the middle, so the two halves of a face cannot disagree. */
const bothSides = (body) => `${body}
  <g transform="translate(512 0) scale(-1 1)">${body}</g>`;

/** One ear: the darker outer disc with the inner ear sitting inside it. */
const EARS = `
  <ellipse cx="${C - 141}" cy="${C - 128}" rx="62" ry="53" transform="rotate(-22 ${C - 141} ${C - 128})" fill="${FUR_D}"/>
  <ellipse cx="${C - 139}" cy="${C - 126}" rx="37" ry="31" transform="rotate(-22 ${C - 139} ${C - 126})" fill="${EAR}"/>`;

/** One half of the mask and the eye inside it. The mask is the whole trick at small sizes. */
const EYES = `
  <ellipse cx="${C - 68}" cy="${C - 38}" rx="64" ry="50" transform="rotate(-14 ${C - 68} ${C - 38})" fill="${MASK}"/>
  <circle cx="${C - 68}" cy="${C - 38}" r="29" fill="#ffffff"/>
  <circle cx="${C - 68}" cy="${C - 38}" r="18" fill="${NOSE}"/>
  <circle cx="${C - 75}" cy="${C - 46}" r="6.5" fill="#ffffff" opacity="0.9"/>`;

/**
 * Head, ears and snout: the silhouette, in the order they stack.
 *
 * A meerkat's head is a wedge, not a ball. The first attempt drew it as a ball with ears on and
 * came out a teddy bear, so the head is narrower than it is tall and the snout runs out past its
 * outline instead of sitting inside it. There are no shoulders: drawn in the same fur they merged
 * with the muzzle into one shape at the chin, and a head alone is what survives at forty-eight
 * pixels anyway.
 */
const FACE = `
  ${bothSides(EARS)}
  <path d="M ${at(0, -156)}
           Q ${at(132, -150)} ${at(139, -18)}
           Q ${at(143, 66)} ${at(72, 96)}
           Q ${at(0, 124)} ${at(-72, 96)}
           Q ${at(-143, 66)} ${at(-139, -18)}
           Q ${at(-132, -150)} ${at(0, -156)} Z" fill="${FUR}"/>
  <path d="M ${at(-60, 24)} Q ${at(0, 36)} ${at(60, 24)} Q ${at(66, 96)} ${at(0, 120)} Q ${at(-66, 96)} ${at(-60, 24)} Z" fill="${FUR}"/>
  <ellipse cx="${C}" cy="${C + 76}" rx="52" ry="46" fill="${BELLY}"/>
  ${bothSides(EYES)}
  <ellipse cx="${C}" cy="${C + 54}" rx="27" ry="21" fill="${NOSE}"/>
  <path d="M ${at(-26, 84)} Q ${at(0, 99)} ${at(26, 84)}" fill="none" stroke="${NOSE}" stroke-width="12" stroke-linecap="round"/>`;

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
  const pull = mode === 'maskable' ? 0.68 : mode === 'foreground' ? 0.60 : 0.92;
  const ground = mode === 'foreground'
    ? ''
    : `<rect width="512" height="512" fill="url(#dusk)"/>
       <path d="M ${at(-256, 232)} Q ${at(0, 168)} ${at(256, 232)} L ${at(256, 256)} L ${at(-256, 256)} Z" fill="${SAND}" opacity="0.95"/>`;
  const cut = mode === 'round'
    ? `<clipPath id="disc"><circle cx="256" cy="256" r="256"/></clipPath>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="dusk" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2d6c85"/><stop offset="0.55" stop-color="#1b4a5f"/><stop offset="1" stop-color="#10313f"/>
    </linearGradient>
    ${cut}
  </defs>
  <g ${mode === 'round' ? 'clip-path="url(#disc)"' : ''}>
  ${ground}
  <g transform="translate(${C} ${C}) scale(${pull}) translate(${-C} ${-C})">
    ${FACE}
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

// ---- iOS, which wants one square and rounds it itself
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

// and the colour behind that foreground: the dusk he stands against
writeFileSync(`${ANDROID}/values/ic_launcher_background.xml`,
  `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#1B4A5F</color>\n</resources>\n`);
console.log(`${(ANDROID + '/values/ic_launcher_background.xml').padEnd(62)}        #1B4A5F`);
