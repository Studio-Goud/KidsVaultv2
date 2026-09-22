/**
 * The photographs for Letterbos.
 *
 * Letterbos is a reading game: a picture appears and a child builds the word for it out of sounds.
 * That only works if the picture names itself. A hundred and forty-one of them were canvas
 * drawings, and for a good half of the list a drawing is still the right answer - but a child
 * learning *olifant*, *maan* or *schaap* should be looking at the real thing.
 *
 * This is the same pipeline the animal book already uses, pointed at a word list instead of a
 * species list: ask Wikipedia which photograph leads the article about this thing, ask Wikimedia
 * Commons who took it and under which licence, keep nothing that is not free to show, cache every
 * reply on disk so a second run costs nothing, and write one compact file into `public/` that the
 * game fetches at runtime.
 *
 *   npm run words              # build (uses the cache)
 *   npm run words -- --fresh   # ignore the cache
 *   npm run words -- --sheet   # also write a contact sheet to look the photographs over
 *
 * The judgement is in `PLAN` below, one line per word. It is not a switch to flip on everything:
 * a photograph of a pen is one pen on one desk, and the drawn pen is every pen. Natural kinds -
 * animals, plants, food, weather, materials - win with a photograph. Generic manufactured things,
 * body parts, numbers and anything abstract keep their drawing, and the reason is written beside
 * the word. A word whose photograph turns out badly is moved back to `drawn` here rather than
 * patched over in the game.
 *
 * Nothing in the game depends on this file having been run: `public/letters/photos.json` is
 * fetched after the first frame is already on screen, and every word still has its drawing.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const CACHE = join(ROOT, '.cache', 'letters');
const OUT = join(ROOT, 'public', 'letters', 'photos.json');
const FRESH = process.argv.includes('--fresh');

const UA = 'BraambosLetterbos/1.0 (a children\'s reading game; contact ricardovanrijn2@gmail.com)';

// ---------------------------------------------------------------- what a photograph is allowed to be

/**
 * The only licences that may be shipped: public domain, CC0, CC BY and CC BY-SA, at any version.
 *
 * `-NC` (not for commercial use) and `-ND` (no changes) are both out. They are out even though
 * this is a children's game given away, because a photograph cropped to fill a frame is a change,
 * and because a licence that has to be argued about is not one to build a pipeline on. The test
 * for it is deliberately two-sided: the shape has to match *and* neither marker may appear.
 */
const FREE = /^(cc0|cc by [0-9]|cc by-sa [0-9]|public domain|pd|attribution)/i;
const UNFREE = /\b(nc|nd|noncommercial|non-commercial|noderiv)\b/i;

export const isFreeLicence = name => {
  const s = String(name ?? '').replace(/\s+/g, ' ').trim();
  return FREE.test(s) && !UNFREE.test(s);
};

/**
 * Is this record good enough to put in front of a child?
 *
 * A photograph with nobody to credit is not one this project ships, whatever its licence says -
 * the credit line is the payment. The check is pure and the game runs it again at load time, so a
 * half-written record falls back to the drawing rather than to a hole.
 */
export const isUsablePhoto = rec =>
  !!rec && typeof rec.p === 'string' && rec.p.length > 0
  && typeof rec.c === 'string' && rec.c.trim().length > 0
  && typeof rec.l === 'string' && isFreeLicence(rec.l);

// ---------------------------------------------------------------- the judgement, word by word

/**
 * Every word in `src/games/letters/words.ts`, and what it should be looking at.
 *
 *   photo  a thing that exists and is photographed head-on a thousand times over: a child knows
 *          it the moment they see it, and the drawing was only ever an approximation of it
 *   drawn  a photograph would be *worse*. Three reasons keep coming back, and each one is written
 *          out at the word where it first applies
 *
 * `src` is the list of places to look, best first: `nl:Title` or `en:Title` takes the photograph
 * that leads that Wikipedia article, `File:Name.jpg` names a file on Commons outright. The first
 * one that is free and has a photographer wins; if none of them do, the word keeps its drawing.
 */
export const PLAN = {
  // ---- three letters, one short vowel
  // a photographed bus is one bus in one street on one afternoon; the drawn bus is every bus,
  // which is the one a child needs while they are still learning what the word covers
  bus: { art: 'drawn', why: 'one particular bus in one particular street' },
  kat: { art: 'photo', src: ['en:Cat', 'nl:Kat (dier)'] },
  pen: { art: 'drawn', why: 'one particular pen; the drawn one is every pen' },
  vis: { art: 'photo', src: ['en:Fish', 'nl:Vissen (dieren)'] },
  // the one the owner asked for by name, and the one that lost on looking at it: every free
  // photograph of the sun is a white blur behind a flare, and a child has to work out what they
  // are seeing. The drawn sun is the yellow disc with rays that they already mean by the word
  zon: { art: 'drawn', why: 'the sun photographs as a white flare; the drawn disc is what is meant' },
  bal: { art: 'photo', src: ['File:Football Pallo valmiina-cropped.jpg', 'nl:Voetbal (voorwerp)'] },
  kip: { art: 'photo', src: ['File:Gallus gallus domesticus LC0262.jpg', 'File:Hen on street.jpg'] },
  mus: { art: 'photo', src: ['nl:Huismus', 'en:House sparrow'] },
  rok: { art: 'drawn', why: 'a garment photographed is one garment on one person' },
  tak: { art: 'drawn', why: 'a branch photographs as part of a tree, never as a branch' },
  bos: { art: 'photo', src: ['File:The Green Path (184194351).jpeg'] },
  pet: { art: 'photo', src: ['en:Baseball cap'] },
  jas: { art: 'drawn', why: 'a garment photographed is one garment on one person' },
  mes: { art: 'drawn', why: 'every free photograph is a knife block or a close-up of one blade' },
  zak: { art: 'drawn', why: 'sack, bag or pocket - the photograph has to pick one' },
  kam: { art: 'photo', src: ['en:Comb'] },
  // a real bone reads as a piece of a skeleton; the drawn one is the bone shape a child names
  bot: { art: 'drawn', why: 'a real bone reads as a skeleton, not as the bone a dog carries' },
  hok: { art: 'drawn', why: 'every hutch looks different; the drawing is the idea of one' },
  net: { art: 'drawn', why: 'a net photographs as mesh over something else' },
  pot: { art: 'drawn', why: 'jar, pot or plant pot - the photograph has to pick one' },
  rat: { art: 'photo', src: ['en:Rat', 'en:Brown rat'] },
  // you cannot photograph a number. The drawing is six things counted, which is the point
  zes: { art: 'drawn', why: 'a number is not a thing; the drawing counts six of them' },
  bel: { art: 'drawn', why: 'no free photograph of a bell that a child reads as a bell' },
  pop: { art: 'drawn', why: 'photographed dolls are uncanny at this size' },
  sok: { art: 'drawn', why: 'a garment photographed is one garment' },
  tas: { art: 'drawn', why: 'a garment-shaped artefact; every bag is a different bag' },
  dak: { art: 'drawn', why: 'a roof photographs as a house' },
  gat: { art: 'drawn', why: 'a hole is the absence of a thing' },
  wol: { art: 'photo', src: ['nl:Wol', 'en:Wool'] },
  kop: { art: 'photo', src: ['en:Mug'] },
  man: { art: 'drawn', why: 'a photograph of a man is a photograph of one man' },
  mat: { art: 'drawn', why: 'a mat photographs as floor' },
  kom: { art: 'drawn', why: 'a generic vessel; the drawing is the bowl shape itself' },
  bok: { art: 'drawn', why: 'a billy goat photographs identically to geit; the drawings differ' },
  hek: { art: 'drawn', why: 'a fence photographs as a field with a fence in it' },
  vos: { art: 'photo', src: ['nl:Vos (dier)', 'en:Red fox'] },

  // ---- the doubled vowel
  maan: { art: 'photo', src: ['nl:Maan', 'en:Moon'] },
  boom: { art: 'photo', src: ['en:Tree'] },
  muur: { art: 'drawn', why: 'a wall photographs as whatever building it belongs to' },
  vuur: { art: 'photo', src: ['en:Fire', 'en:Bonfire'] },
  been: { art: 'drawn', why: 'a photographed body part on its own is unpleasant at this size' },
  boot: { art: 'photo', src: ['en:Boat'] },
  haan: { art: 'photo', src: ['File:Rooster portrait2.jpg', 'File:Gallus gallus domesticus (male).jpg'] },
  zeep: { art: 'photo', src: ['en:Soap', 'nl:Zeep'] },
  poot: { art: 'drawn', why: 'a body part; and the poot/pot ladder wants two drawings that rhyme' },
  kaas: { art: 'photo', src: ['File:Gouda.jpg', 'nl:Kaas'] },
  raam: { art: 'drawn', why: 'a window photographs as the wall around it' },
  teen: { art: 'drawn', why: 'a photographed body part on its own is unpleasant at this size' },
  noot: { art: 'photo', src: ['nl:Noot (vrucht)', 'en:Nut (fruit)'] },
  vaas: { art: 'drawn', why: 'a photographed vase is a vase of flowers, which is bloem' },
  mees: { art: 'photo', src: ['nl:Koolmees', 'en:Great tit'] },
  roos: { art: 'photo', src: ['en:Rose', 'nl:Roos (plant)'] },
  zaag: { art: 'photo', src: ['nl:Zaag', 'en:Hand saw', 'en:Saw'] },
  haar: { art: 'drawn', why: 'hair photographs as a head, which is a different word' },
  peer: { art: 'photo', src: ['en:Pear'] },
  veer: { art: 'drawn', why: 'the free photographs of a feather are plates out of old atlases' },

  // ---- the two-letter sounds
  huis: { art: 'photo', src: ['File:Nordisches Einfamilienhaus.jpg', 'en:Cottage'] },
  muis: { art: 'photo', src: ['en:Mouse', 'en:House mouse'] },
  duim: { art: 'drawn', why: 'a photographed thumb reads as the thumbs-up sign, not as a thumb' },
  uil: { art: 'photo', src: ['en:Owl'] },
  tuin: { art: 'drawn', why: 'a garden photographs as a park; nothing in the frame says whose it is' },
  buik: { art: 'drawn', why: 'a photographed body part on its own is unpleasant at this size' },
  boek: { art: 'drawn', why: 'the free lead photographs of a book are medieval manuscripts' },
  koe: { art: 'photo', src: ['nl:Rund', 'en:Cattle'] },
  voet: { art: 'drawn', why: 'a photographed body part on its own is unpleasant at this size' },
  hoed: { art: 'drawn', why: 'a hat photographs on a head, and then the picture is of a person' },
  poes: { art: 'photo', src: ['en:Kitten', 'File:Kitten in a sandbox.jpg'] },
  deur: { art: 'drawn', why: 'a door photographs as the front of a building' },
  neus: { art: 'drawn', why: 'a photographed body part on its own is unpleasant at this size' },
  reus: { art: 'drawn', why: 'there are no giants to photograph' },
  leeuw: { art: 'photo', src: ['en:Lion'] },
  meeuw: { art: 'photo', src: ['en:Gull', 'en:European herring gull'] },
  fiets: { art: 'photo', src: ['nl:Fiets', 'en:Bicycle'] },
  wiel: { art: 'drawn', why: 'a wheel photographs as the car it is bolted to' },
  riem: { art: 'drawn', why: 'belt, strap or oar - the photograph has to pick one' },
  dier: { art: 'drawn', why: 'a category, not a thing: any photograph would name one animal' },

  // ---- ei
  ei: { art: 'photo', src: ['File:Chicken egg 2009-06-04.jpg', 'en:Egg as food', 'nl:Kippenei'] },
  trein: { art: 'photo', src: ['nl:Trein', 'en:Train'] },
  eiland: { art: 'photo', src: ['File:Desertisland.jpg'] },
  geit: { art: 'photo', src: ['en:Goat', 'nl:Geit'] },
  zeil: { art: 'drawn', why: 'a sail photographs as a sailing boat, which is boot' },
  eik: { art: 'drawn', why: 'an oak photographs exactly like boom; the drawing adds the acorn' },
  reis: { art: 'drawn', why: 'a journey is not a thing you can point a camera at' },
  plein: { art: 'drawn', why: 'a square photographs as the town around it' },
  dweil: { art: 'drawn', why: 'a floorcloth photographs as a wet floor' },
  sein: { art: 'drawn', why: 'a signal means something; the drawing says which' },

  // ---- ij
  ijs: { art: 'photo', src: ['en:Ice cream'] },
  rijst: { art: 'photo', src: ['File:Meshi 001.jpg', 'en:Cooked rice'] },
  vijf: { art: 'drawn', why: 'a number is not a thing; the drawing is a hand holding five up' },
  bij: { art: 'photo', src: ['nl:Honingbij', 'en:Honey bee'] },
  zwijn: { art: 'photo', src: ['nl:Wild zwijn', 'en:Wild boar'] },
  dijk: { art: 'drawn', why: 'a dyke photographs as a landscape with a line in it' },
  pijl: { art: 'drawn', why: 'an arrow is a sign before it is an object' },
  lijm: { art: 'drawn', why: 'glue photographs as a branded bottle' },
  prijs: { art: 'drawn', why: 'a prize is an idea about an object' },
  krijt: { art: 'photo', src: ['File:Chalk sticks.jpg', 'en:Sidewalk chalk', 'nl:Schoolkrijt'] },

  // ---- au
  blauw: { art: 'drawn', why: 'a colour is not a thing; the drawing is the colour itself' },
  pauw: { art: 'photo', src: ['en:Peacock', 'nl:Pauw (vogel)'] },
  saus: { art: 'drawn', why: 'sauce photographs as the dinner it is on' },
  klauw: { art: 'drawn', why: 'a claw photographs as the animal it belongs to' },
  dauw: { art: 'drawn', why: 'dew photographs as a close-up a child cannot name' },
  augurk: { art: 'photo', src: ['File:Whole pickled cucumbers on a white plate.jpg', 'en:Pickled cucumber'] },

  // ---- ou
  koud: { art: 'drawn', why: 'cold is a feeling' },
  hout: { art: 'photo', src: ['en:Firewood', 'nl:Hout'] },
  goud: { art: 'photo', src: ['File:China - 5732266939 Gold - Münzen - Barren.jpg', 'en:Gold bar'] },
  zout: { art: 'drawn', why: 'a heap of salt photographs exactly like a heap of sugar' },
  fout: { art: 'drawn', why: 'a mistake is not a thing' },
  touw: { art: 'photo', src: ['en:Rope', 'nl:Touw'] },
  kous: { art: 'drawn', why: 'a garment photographed is one garment on one leg' },
  mouw: { art: 'drawn', why: 'a sleeve photographs as the person wearing it' },

  // ---- consonants stacked up
  schaap: { art: 'photo', src: ['nl:Schaap', 'en:Sheep'] },
  school: { art: 'drawn', why: 'a school photographs as a building like any other' },
  schip: { art: 'photo', src: ['File:Prinsendam (ship, 1988) 001.jpg', 'en:Ship'] },
  schoen: { art: 'drawn', why: 'the free lead photographs of a shoe are museum cases' },
  straat: { art: 'photo', src: ['en:Street'] },
  strand: { art: 'photo', src: ['en:Beach'] },
  stoel: { art: 'drawn', why: 'the free lead photographs of a chair are museum sets' },
  ster: { art: 'drawn', why: 'a star photographs as a dot; the drawn star is the shape a child means' },
  spin: { art: 'photo', src: ['en:Spider', 'en:European garden spider'] },
  spons: { art: 'photo', src: ['en:Sponge (tool)'] },
  slang: { art: 'photo', src: ['en:Snake'] },
  slak: { art: 'photo', src: ['en:Snail', 'nl:Slakken'] },
  snoep: { art: 'drawn', why: 'sweets photograph as a shop counter or a heap nothing names' },
  sneeuw: { art: 'photo', src: ['nl:Sneeuw', 'en:Snow'] },
  plank: { art: 'drawn', why: 'a plank photographs as a pile of timber' },
  plant: { art: 'photo', src: ['en:Houseplant', 'nl:Kamerplant'] },
  klomp: { art: 'photo', src: ['en:Clog'] },
  kraan: { art: 'photo', src: ['en:Tap (valve)'] },
  krab: { art: 'photo', src: ['en:Crab'] },
  trap: { art: 'drawn', why: 'stairs photograph as the hall they are in' },
  trui: { art: 'drawn', why: 'a garment photographed is one garment' },
  brood: { art: 'photo', src: ['nl:Brood', 'en:Bread'] },
  bloem: { art: 'photo', src: ['en:Flower', 'nl:Bloem (plant)'] },
  druif: { art: 'photo', src: ['en:Grape'] },
  vlag: { art: 'drawn', why: 'a photographed flag is one country\'s flag on one pole' },
  zwaan: { art: 'photo', src: ['en:Swan', 'en:Mute swan'] },
  angst: { art: 'drawn', why: 'fear is a feeling' },
  herfst: { art: 'photo', src: ['en:Autumn'] },
  worst: { art: 'photo', src: ['nl:Worst', 'en:Sausage'] },
  ring: { art: 'photo', src: ['en:Ring (jewellery)'] },
  bank: { art: 'photo', src: ['File:Bench in park.jpg'] },
};

// ---------------------------------------------------------------- asking, politely and once

mkdirSync(CACHE, { recursive: true });

const sleep = ms => new Promise(r => setTimeout(r, ms));
const key = s => createHash('sha1').update(s).digest('hex').slice(0, 24);

let cached = false;
const pace = ms => (cached ? Promise.resolve() : sleep(ms));

/** Every request goes through here: cached on disk, retried with a growing wait. */
async function ask(url, init, label) {
  const k = join(CACHE, `${key(url + (init?.body ?? ''))}.json`);
  if (!FRESH && existsSync(k)) {
    try {
      const hit = JSON.parse(readFileSync(k, 'utf8'));
      cached = true;
      return hit;
    } catch { /* rewrite it */ }
  }
  cached = false;
  for (let i = 0; i < 6; i++) {
    try {
      const res = await fetch(url, { ...init, headers: { 'User-Agent': UA, Accept: 'application/json', ...(init?.headers ?? {}) } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json();
      writeFileSync(k, JSON.stringify(j));
      return j;
    } catch (e) {
      if (i === 5) { console.warn(`  ! gave up on ${label ?? url}: ${e.message}`); return null; }
      await sleep((/429/.test(String(e.message)) ? 2600 : 700) * (i + 1));
    }
  }
  return null;
}

const form = body => ({ method: 'POST', body: new URLSearchParams(body), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
const chunks = (a, n) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));
const stripTags = s => String(s ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

// ---------------------------------------------------------------- step 1: which file leads which article

/** `nl:Maan` -> `File:FullMoon2010.jpg`, in batches of forty, one call per language. */
async function leadFiles(refs) {
  const out = new Map();
  const bySite = {};
  for (const ref of refs) {
    const site = ref.slice(0, 2);
    (bySite[site] ??= []).push(ref.slice(3));
  }
  for (const [site, list] of Object.entries(bySite)) {
    const batches = chunks([...new Set(list)], 40);
    for (let i = 0; i < batches.length; i++) {
      const d = await ask(`https://${site}.wikipedia.org/w/api.php`, form({
        action: 'query', format: 'json', formatversion: '2', redirects: '1',
        prop: 'pageimages', piprop: 'name', pilimit: '50', titles: batches[i].join('|'),
      }), `${site} leads ${i}`);
      const norm = new Map();
      for (const n of d?.query?.normalized ?? []) norm.set(n.to, n.from);
      for (const r of d?.query?.redirects ?? []) norm.set(r.to, norm.get(r.from) ?? r.from);
      for (const p of d?.query?.pages ?? []) {
        if (p.missing || !p.pageimage) continue;
        out.set(`${site}:${norm.get(p.title) ?? p.title}`, `File:${String(p.pageimage).replace(/_/g, ' ')}`);
      }
      await pace(300);
    }
    console.log(`  ${site}.wikipedia: ${list.length} articles asked`);
  }
  return out;
}

// ---------------------------------------------------------------- step 2: who took it, and may we show it

/**
 * Everything the game needs about one file: where the thumbnail lives, who made it, and under
 * which licence. Asked of Commons in batches of fifty, which is one call per fifty photographs.
 */
async function fileInfo(files) {
  const out = new Map();
  const batches = chunks([...new Set(files)], 50);
  for (let i = 0; i < batches.length; i++) {
    const d = await ask('https://commons.wikimedia.org/w/api.php', form({
      action: 'query', format: 'json', formatversion: '2',
      prop: 'imageinfo', iiprop: 'url|size|extmetadata', iiurlwidth: '960',
      iiextmetadatafilter: 'LicenseShortName|Artist|Credit', titles: batches[i].join('|'),
    }), `commons ${i}`);
    for (const p of d?.query?.pages ?? []) {
      const ii = p.imageinfo?.[0];
      if (!ii) continue;
      let who = stripTags(ii.extmetadata?.Artist?.value) || stripTags(ii.extmetadata?.Credit?.value);
      if (who.length > 54) who = who.slice(0, 51).trim() + '…';
      out.set(p.title, {
        path: commonsPath(ii.thumburl ?? ii.url ?? ''),
        lic: stripTags(ii.extmetadata?.LicenseShortName?.value),
        who,
        mime: ii.mime ?? '',
        w: ii.width ?? 0,
        h: ii.height ?? 0,
      });
    }
    await pace(320);
  }
  console.log(`  Wikimedia Commons: ${out.size} files checked`);
  return out;
}

/**
 * The bit of a Commons address after `/commons/`, with the width left as a hole.
 *
 * A thumbnail is `thumb/e/e1/Moon.jpg/960px-Moon.jpg`, which becomes `thumb/e/e1/Moon.jpg/{w}px-Moon.jpg`
 * so one record serves the little card on the ladder and the big frame in the game from the same
 * browser cache. A file smaller than the width asked for has no thumbnail at all and comes back as
 * `e/e1/Moon.jpg`, which is stored as it is and used at full size.
 */
function commonsPath(url) {
  const raw = url.split('?')[0].split('/wikipedia/commons/')[1];
  if (!raw) return '';
  const parts = raw.split('/');
  const last = parts.length - 1;
  if (parts[0] === 'thumb' && /^\d+px-/.test(parts[last])) {
    parts[last] = parts[last].replace(/^\d+px-/, '{w}px-');
  }
  return parts.join('/');
}

// ---------------------------------------------------------------- step 3: the contact sheet

/**
 * A page of every photograph the run chose, at the size the game draws it, with the word under it.
 *
 * This is the only honest way to check the one thing that matters - whether a four year old would
 * say the word out loud on seeing it - so it is part of the pipeline rather than a thing done once
 * by hand. Open `.cache/letters/sheet.html`, and move anything that does not name itself to
 * `drawn` above.
 */
function contactSheet(rows) {
  const cells = rows.map(r => `<figure><img src="${r.url}" alt=""><figcaption>${r.w}</figcaption></figure>`).join('\n');
  const html = `<!doctype html><meta charset="utf-8"><title>Letterbos — de foto's</title>
<style>
 body{background:#f6f1e4;font:600 15px/1.3 system-ui,sans-serif;color:#2f3e2a;margin:16px}
 .grid{display:grid;grid-template-columns:repeat(6,168px);gap:14px}
 figure{margin:0}
 img{width:168px;height:132px;object-fit:cover;border-radius:10px;background:#ddd6c4;display:block}
 figcaption{text-align:center;padding-top:4px}
</style>
<div class="grid">${cells}</div>`;
  const at = join(CACHE, 'sheet.html');
  writeFileSync(at, html);
  console.log(`  contact sheet: ${at}`);
}

// ---------------------------------------------------------------- putting it together

async function main() {
  const words = Object.keys(PLAN);
  const wanted = words.filter(w => PLAN[w].art === 'photo');
  console.log(`${words.length} words, ${wanted.length} of them asking for a photograph.`);

  console.log('Asking Wikipedia which photograph leads which article…');
  const refs = wanted.flatMap(w => (PLAN[w].src ?? []).filter(s => !s.startsWith('File:')));
  const leads = await leadFiles(refs);

  console.log('Asking Wikimedia Commons who took them…');
  const files = wanted.flatMap(w => (PLAN[w].src ?? []).map(s => (s.startsWith('File:') ? s : leads.get(s))).filter(Boolean));
  const info = await fileInfo(files);

  console.log('Choosing…');
  /** the licence names, interned: a dozen of them across a hundred and forty photographs */
  const licences = [];
  const codeOf = name => {
    let at = licences.indexOf(name);
    if (at < 0) { licences.push(name); at = licences.length - 1; }
    return at;
  };

  const out = [];
  const sheet = [];
  const missed = [];
  for (const w of words) {
    const plan = PLAN[w];
    if (plan.art !== 'photo') { out.push({ w, a: 'drawn' }); continue; }
    let picked = null;
    for (const s of plan.src ?? []) {
      const file = s.startsWith('File:') ? s : leads.get(s);
      const got = file ? info.get(file) : null;
      if (!got || !got.path) continue;
      const rec = { p: got.path, c: got.who, l: got.lic };
      if (!isUsablePhoto(rec)) continue;
      picked = { ...rec, file };
      break;
    }
    if (!picked) {
      // nothing free and credited turned up, so the word keeps its drawing rather than a blank
      missed.push(w);
      out.push({ w, a: 'drawn' });
      continue;
    }
    out.push({ w, a: 'photo', p: picked.p, c: picked.c, l: codeOf(picked.l) });
    sheet.push({ w, file: picked.file, url: `https://upload.wikimedia.org/wikipedia/commons/${picked.p.replace('{w}', '330')}` });
  }

  const photos = out.filter(r => r.a === 'photo');
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify({
    v: 1,
    built: new Date().toISOString().slice(0, 10),
    base: 'https://upload.wikimedia.org/wikipedia/commons/',
    source: 'Wikimedia Commons',
    licences,
    words: out,
  }));

  if (process.argv.includes('--sheet')) {
    contactSheet(sheet);
    for (const r of sheet) console.log(`    ${r.w.padEnd(8)} ${r.file}`);
  }

  const kb = Math.round(readFileSync(OUT).length / 1024);
  console.log(`\n${out.length} words written to public/letters/photos.json (${kb} kB)`);
  console.log(`  ${photos.length} with a photograph, ${out.length - photos.length} keeping their drawing`);
  console.log(`  licences used: ${licences.join(', ')}`);
  if (missed.length) console.log(`  no free photograph found, fell back to the drawing: ${missed.join(', ')}`);
}

if (process.argv[1] && process.argv[1].endsWith('letterwords.mjs')) {
  main().catch(e => { console.error(e); process.exit(1); });
}
