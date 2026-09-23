/**
 * Builds the animal book's data file out of three open databases.
 *
 *   iNaturalist  which species a child is likely to meet or look up, what they are called in
 *                Dutch and in English, and how their family tree runs
 *   Wikipedia    one paragraph about each one, in Dutch and in English, and the lead photograph
 *   Wikimedia    who took that photograph and under which licence, so nothing goes in that we
 *   Commons      are not allowed to show
 *   GBIF         where the species has actually been recorded, which becomes the world map
 *
 * Body length, diet and habitat are not in any of them in a form you can read out to a five year
 * old, so those come from `animal-traits.mjs`, looked up species first and then up the family tree.
 *
 * Everything lands in `public/animals/animals.json`, which the app fetches once. The raw replies
 * are cached in `.cache/animals/` so a second run costs nothing.
 *
 *   node scripts/animals.mjs            # build (uses the cache)
 *   node scripts/animals.mjs --fresh    # ignore the cache
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DIET, HABITAT, SIZE_CM, lookUp } from './animal-traits.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = join(ROOT, '.cache', 'animals');
const OUT = join(ROOT, 'public', 'animals', 'animals.json');
const FRESH = process.argv.includes('--fresh');

const UA = 'SuriAnimalBook/1.0 (a children\'s nature encyclopedia; contact ricardovanrijn2@gmail.com)';

mkdirSync(CACHE, { recursive: true });

const sleep = ms => new Promise(r => setTimeout(r, ms));
const key = s => createHash('sha1').update(s).digest('hex').slice(0, 24);

/** True when the last ask() was answered out of the cache, so there is nobody to be polite to. */
let cached = false;
/** Wait between calls - but not when the answer came off the disk. */
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
  for (let i = 0; i < 8; i++) {
    try {
      const res = await fetch(url, { ...init, headers: { 'User-Agent': UA, Accept: 'application/json', ...(init?.headers ?? {}) } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json();
      writeFileSync(k, JSON.stringify(j));
      return j;
    } catch (e) {
      if (i === 7) { console.warn(`  ! gave up on ${label ?? url}: ${e.message}`); return null; }
      // a 429 is not a hiccup, it is a request to slow down, so it waits appreciably longer
      await sleep((/429/.test(String(e.message)) ? 2600 : 800) * (i + 1));
    }
  }
  return null;
}

const form = body => ({ method: 'POST', body: new URLSearchParams(body), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

/** Run `work` over `items`, `n` at a time. */
async function pool(items, n, work) {
  const out = new Array(items.length);
  let at = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    for (;;) {
      const i = at++;
      if (i >= items.length) return;
      out[i] = await work(items[i], i);
    }
  }));
  return out;
}

const chunks = (a, n) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

// ---------------------------------------------------------------- what to harvest

/**
 * The shelves of the book. Each one is an iNaturalist taxon and how many species to take from it,
 * most-observed first - which is a good stand-in for "most likely to be looked up", because it is
 * what people actually photograph.
 */
const SHELVES = [
  { group: 'mam', taxon: 40151, want: 420, label: 'Mammalia' },
  { group: 'bir', taxon: 3, want: 460, label: 'Aves' },
  { group: 'fis', taxon: 47178, want: 300, label: 'Actinopterygii' },
  { group: 'fis', taxon: 196614, want: 110, label: 'Chondrichthyes (sharks and rays)' },
  { group: 'rep', taxon: 26036, want: 300, label: 'Reptilia' },
  { group: 'amp', taxon: 20978, want: 220, label: 'Amphibia' },
  { group: 'but', taxon: 47224, want: 300, label: 'Papilionoidea (butterflies)' },
  { group: 'but', taxon: 47157, want: 160, label: 'Lepidoptera (moths)' },
  { group: 'ins', taxon: 47208, want: 150, label: 'Coleoptera' },
  { group: 'ins', taxon: 47201, want: 120, label: 'Hymenoptera' },
  { group: 'ins', taxon: 47792, want: 110, label: 'Odonata' },
  { group: 'ins', taxon: 47744, want: 100, label: 'Hemiptera' },
  { group: 'ins', taxon: 47822, want: 90, label: 'Diptera' },
  { group: 'ins', taxon: 47651, want: 70, label: 'Orthoptera' },
  { group: 'spi', taxon: 47119, want: 200, label: 'Arachnida' },
  { group: 'sea', taxon: 47115, want: 220, label: 'Mollusca' },
  { group: 'sea', taxon: 47187, want: 120, label: 'Malacostraca' },
  { group: 'sea', taxon: 47549, want: 80, label: 'Echinodermata' },
  { group: 'sea', taxon: 47534, want: 80, label: 'Cnidaria' },
  { group: 'sea', taxon: 47491, want: 50, label: 'Annelida' },
];

/**
 * Nobody photographs a tiger on iNaturalist, because nobody meets one. These are here because a
 * child will look for them on the first day, and a book of animals without a lion is not one.
 */
const MUST_HAVE = [
  'Panthera leo', 'Panthera tigris', 'Panthera onca', 'Panthera pardus', 'Panthera uncia',
  'Acinonyx jubatus', 'Loxodonta africana', 'Elephas maximus', 'Giraffa camelopardalis',
  'Hippopotamus amphibius', 'Ceratotherium simum', 'Diceros bicornis', 'Ailuropoda melanoleuca',
  'Ursus maritimus', 'Ursus arctos', 'Gorilla gorilla', 'Gorilla beringei', 'Pan troglodytes',
  'Pan paniscus', 'Pongo pygmaeus', 'Pongo abelii', 'Lemur catta', 'Mandrillus sphinx',
  'Balaenoptera musculus', 'Megaptera novaeangliae', 'Orcinus orca', 'Physeter macrocephalus',
  'Tursiops truncatus', 'Odobenus rosmarus', 'Trichechus manatus', 'Monodon monoceros',
  'Equus quagga', 'Equus grevyi', 'Connochaetes taurinus', 'Oryx gazella', 'Aepyceros melampus',
  'Crocuta crocuta', 'Lycaon pictus', 'Suricata suricatta', 'Vulpes lagopus', 'Vulpes zerda',
  'Canis lupus', 'Alces alces', 'Rangifer tarandus', 'Bison bison', 'Bison bonasus',
  'Camelus dromedarius', 'Camelus bactrianus', 'Lama glama', 'Vicugna pacos',
  'Phascolarctos cinereus', 'Vombatus ursinus', 'Ornithorhynchus anatinus', 'Tachyglossus aculeatus',
  'Myrmecophaga tridactyla', 'Bradypus variegatus', 'Choloepus hoffmanni', 'Manis javanica',
  'Struthio camelus', 'Dromaius novaehollandiae', 'Aptenodytes forsteri', 'Pygoscelis papua',
  'Spheniscus demersus', 'Phoenicopterus roseus', 'Haliaeetus leucocephalus', 'Aquila chrysaetos',
  'Bubo bubo', 'Tyto alba', 'Ara macao', 'Psittacus erithacus', 'Pavo cristatus',
  'Ramphastos toco', 'Grus japonensis', 'Pelecanus onocrotalus', 'Fratercula arctica',
  'Rhincodon typus', 'Cetorhinus maximus', 'Carcharodon carcharias', 'Galeocerdo cuvier',
  'Sphyrna mokarran', 'Prionace glauca', 'Carcharhinus leucas', 'Mobula birostris',
  'Thunnus thynnus', 'Xiphias gladius', 'Mola mola', 'Hippocampus hippocampus',
  'Amphiprion ocellaris', 'Pterois volitans', 'Anguilla anguilla', 'Salmo salar',
  'Crocodylus porosus', 'Crocodylus niloticus', 'Alligator mississippiensis',
  'Varanus komodoensis', 'Iguana iguana', 'Chelonia mydas', 'Dermochelys coriacea',
  'Chelonoidis niger', 'Python bivittatus', 'Eunectes murinus', 'Boa constrictor',
  'Ophiophagus hannah', 'Naja naja', 'Crotalus atrox', 'Vipera berus',
  'Phyllobates terribilis', 'Dendrobates auratus', 'Ambystoma mexicanum', 'Andrias japonicus',
  'Salamandra salamandra', 'Bufo bufo', 'Rana temporaria', 'Hyla arborea',
  'Danaus plexippus', 'Papilio machaon', 'Morpho peleides', 'Attacus atlas', 'Aglais io',
  'Apis mellifera', 'Bombus terrestris', 'Vespa crabro', 'Lucanus cervus', 'Dynastes hercules',
  'Mantis religiosa', 'Anax imperator', 'Coccinella septempunctata', 'Locusta migratoria',
  'Araneus diadematus', 'Argiope bruennichi', 'Theraphosa blondi', 'Latrodectus mactans',
  'Pandinus imperator', 'Architeuthis dux', 'Octopus vulgaris', 'Sepia officinalis',
  'Nautilus pompilius', 'Homarus gammarus', 'Cancer pagurus', 'Birgus latro',
  'Asterias rubens', 'Aurelia aurita', 'Cyanea capillata', 'Physalia physalis',
  'Limulus polyphemus', 'Helix pomatia', 'Tridacna gigas', 'Lumbricus terrestris',
];

/**
 * Out of the book, by name.
 *
 * Wikipedia's article on Homo sapiens leads with an anatomical drawing of a naked man and woman,
 * which is exactly right for an encyclopaedia and exactly wrong for a five year old scrolling a
 * grid of animals. The human lice are here for the same reason: the photograph is only a louse,
 * but the page a child would be reading about is not one a five year old needs.
 */
const NOT_FOR_CHILDREN = [
  'Homo sapiens', 'Homo', 'Pthirus pubis', 'Phthirus pubis', 'Pediculus humanus',
  'Enterobius vermicularis', 'Sarcoptes scabiei',
];

const GROUP_OF_ANCESTOR = [
  [47224, 'but'], [47157, 'but'], [47119, 'spi'], [47158, 'ins'], [40151, 'mam'], [3, 'bir'],
  [26036, 'rep'], [20978, 'amp'], [47178, 'fis'], [196614, 'fis'], [47273, 'fis'],
  [47115, 'sea'], [47187, 'sea'], [47549, 'sea'], [47534, 'sea'], [47491, 'sea'], [85493, 'sea'],
];

// ---------------------------------------------------------------- step 1: iNaturalist

async function harvest() {
  const byName = new Map();
  for (const shelf of SHELVES) {
    let taken = 0;
    for (let page = 1; taken < shelf.want && page <= 30; page++) {
      const url = 'https://api.inaturalist.org/v1/taxa?' + new URLSearchParams({
        taxon_id: String(shelf.taxon), rank: 'species', order_by: 'observations_count',
        order: 'desc', per_page: '200', page: String(page), locale: 'nl',
      });
      const d = await ask(url, undefined, `${shelf.label} p${page}`);
      if (!d?.results?.length) break;
      for (const t of d.results) {
        if (t.extinct) continue;
        if (!byName.has(t.name)) { byName.set(t.name, { ...t, group: shelf.group }); taken++; }
      }
      await pace(250);
    }
    console.log(`  ${shelf.label}: ${taken} species (${byName.size} in total)`);
  }

  // the famous ones, by name
  const missing = MUST_HAVE.filter(n => !byName.has(n));
  for (const batch of chunks(missing, 1)) {
    const url = 'https://api.inaturalist.org/v1/taxa?' + new URLSearchParams({ q: batch[0], rank: 'species', per_page: '5', locale: 'nl' });
    const d = await ask(url, undefined, batch[0]);
    const hit = d?.results?.find(r => r.name === batch[0]);
    if (hit && !hit.extinct) byName.set(hit.name, { ...hit, group: null });
    await pace(180);
  }
  console.log(`  the famous ones: ${MUST_HAVE.length - missing.length} were already in, ${missing.length} looked up`);
  return [...byName.values()];
}

// ---------------------------------------------------------------- step 2: the family tree

async function ancestors(taxa) {
  const ids = new Set();
  for (const t of taxa) for (const a of t.ancestor_ids ?? []) ids.add(a);
  const list = [...ids];
  const table = new Map();
  const batches = chunks(list, 30);
  for (let i = 0; i < batches.length; i++) {
    const url = `https://api.inaturalist.org/v1/taxa/${batches[i].join(',')}?locale=nl`;
    const d = await ask(url, undefined, `ancestors ${i}`);
    for (const r of d?.results ?? []) {
      table.set(r.id, { name: r.name, rank: r.rank, nl: r.preferred_common_name ?? null, en: r.english_common_name ?? null });
    }
    if (i % 10 === 0) process.stdout.write(`\r  family tree ${i + 1}/${batches.length}   `);
    await pace(200);
  }
  console.log(`\r  family tree: ${table.size} groups named        `);
  return table;
}

// ---------------------------------------------------------------- step 3: Wikipedia

async function wikiMeta(titles, site = 'en.wikipedia.org', wantNl = true, label = 'wikipedia pages') {
  const out = new Map();
  const batches = chunks(titles, 50);
  for (let i = 0; i < batches.length; i++) {
    const d = await ask(`https://${site}/w/api.php`, form({
      action: 'query', format: 'json', formatversion: '2', redirects: '1',
      prop: wantNl ? 'langlinks|pageimages' : 'pageimages', lllang: 'nl', lllimit: '500',
      piprop: 'thumbnail|name', pithumbsize: '800', pilimit: '50',
      titles: batches[i].join('|'),
    }), `${label} ${i}`);
    const norm = new Map();
    for (const n of d?.query?.normalized ?? []) norm.set(n.to, n.from);
    for (const r of d?.query?.redirects ?? []) norm.set(r.to, norm.get(r.from) ?? r.from);
    for (const p of d?.query?.pages ?? []) {
      if (p.missing) continue;
      const asked = norm.get(p.title) ?? p.title;
      out.set(asked, {
        title: p.title,
        nlTitle: p.langlinks?.[0]?.title ?? null,
        thumb: p.thumbnail?.source ?? null,
        // the Commons reply titles these with spaces, so they are keyed that way here too
        file: p.pageimage ? `File:${String(p.pageimage).replace(/_/g, ' ')}` : null,
      });
    }
    if (i % 5 === 0) process.stdout.write(`\r  ${label} ${i + 1}/${batches.length}   `);
    await pace(350);
  }
  console.log(`\r  ${label}: ${out.size} found              `);
  return out;
}

async function extracts(site, titles, label) {
  const out = new Map();
  const batches = chunks(titles, 20);
  for (let i = 0; i < batches.length; i++) {
    const d = await ask(`https://${site}/w/api.php`, form({
      action: 'query', format: 'json', formatversion: '2', redirects: '1',
      prop: 'extracts', exintro: '1', explaintext: '1', exsentences: '3', exlimit: '20',
      titles: batches[i].join('|'),
    }), `${label} ${i}`);
    const norm = new Map();
    for (const n of d?.query?.normalized ?? []) norm.set(n.to, n.from);
    for (const r of d?.query?.redirects ?? []) norm.set(r.to, norm.get(r.from) ?? r.from);
    for (const p of d?.query?.pages ?? []) {
      if (!p.extract) continue;
      out.set(norm.get(p.title) ?? p.title, p.extract);
    }
    if (i % 10 === 0) process.stdout.write(`\r  ${label} ${i + 1}/${batches.length}   `);
    await pace(320);
  }
  console.log(`\r  ${label}: ${out.size} paragraphs            `);
  return out;
}

// ---------------------------------------------------------------- step 4: who took the photograph

const FREE = /^(cc0|cc by [0-9]|cc by-sa [0-9]|public domain|pd|attribution)/i;
const stripTags = s => String(s ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

async function licences(files) {
  const out = new Map();
  const batches = chunks(files, 50);
  for (let i = 0; i < batches.length; i++) {
    const d = await ask('https://commons.wikimedia.org/w/api.php', form({
      action: 'query', format: 'json', formatversion: '2',
      prop: 'imageinfo', iiprop: 'extmetadata',
      iiextmetadatafilter: 'LicenseShortName|Artist|Credit', titles: batches[i].join('|'),
    }), `licences ${i}`);
    for (const p of d?.query?.pages ?? []) {
      const em = p.imageinfo?.[0]?.extmetadata;
      if (!em) continue;
      const lic = stripTags(em.LicenseShortName?.value);
      let who = stripTags(em.Artist?.value) || stripTags(em.Credit?.value);
      if (who.length > 60) who = who.slice(0, 57).trim() + '…';
      out.set(p.title, { lic, who });
    }
    if (i % 5 === 0) process.stdout.write(`\r  photograph licences ${i + 1}/${batches.length}   `);
    await pace(350);
  }
  console.log(`\r  photograph licences: ${out.size} checked          `);
  return out;
}

// ---------------------------------------------------------------- step 5: where it has been seen

const CONTINENT = {
  AFRICA: 'af', EUROPE: 'eu', ASIA: 'as', NORTH_AMERICA: 'na', SOUTH_AMERICA: 'sa',
  OCEANIA: 'oc', ANTARCTICA: 'an',
};

async function where(names) {
  // GBIF is the slowest step by a long way; `--no-map` builds everything else in a few seconds,
  // which is what you want while you are working on the screens rather than on the data
  if (process.argv.includes('--no-map')) {
    console.log('  world map: skipped (--no-map)');
    return names.map(() => []);
  }
  let done = 0;
  const got = await pool(names, 4, async name => {
    const url = 'https://api.gbif.org/v1/occurrence/search?' + new URLSearchParams({
      scientificName: name, facet: 'continent', limit: '0', facetLimit: '10',
    });
    const d = await ask(url, undefined, `gbif ${name}`);
    if (++done % 100 === 0) process.stdout.write(`\r  world map ${done}/${names.length}   `);
    const counts = d?.facets?.[0]?.counts ?? [];
    if (!counts.length) return [];
    const top = counts[0].count;
    return counts
      .filter(c => c.count >= Math.max(3, top * 0.08) && CONTINENT[c.name])
      .slice(0, 4)
      .map(c => CONTINENT[c.name]);
  });
  console.log(`\r  world map: ${got.filter(g => g.length).length} of ${names.length} placed      `);
  return got;
}

// ---------------------------------------------------------------- putting it together

const CUT = /\s*\([^)]*\)\s*$/;
const trimTo = (s, n) => {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim();
  if (t.length <= n) return t;
  const cut = t.slice(0, n);
  const stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  return stop > n * 0.45 ? cut.slice(0, stop + 1) : cut.slice(0, cut.lastIndexOf(' ')) + '…';
};

const tidyName = s => {
  const t = String(s ?? '').replace(CUT, '').trim();
  return t ? t[0].toUpperCase() + t.slice(1) : '';
};

const STATUS = { LC: 'lc', NT: 'nt', VU: 'vu', EN: 'en', CR: 'cr', EW: 'ew', EX: 'ex' };

/**
 * Wikimedia's thumbnailer takes the width straight out of the address, so the width is left as a
 * hole in the stored path and the app fills it in: small ones for a grid of forty cards, a large
 * one for the page of the animal you actually opened. One record, any size, one cache.
 */
/**
 * Almost every thumbnail is named after its own file - `.../Eekhoorn.jpg/{w}px-Eekhoorn.jpg` - so
 * the second half is thrown away where it can be worked out again, which is most of the time and
 * about a fifth of the whole file.
 */
function shortPath(tpl) {
  const f = tpl.split('/');
  return f.length === 4 && f[3] === `{w}px-${f[2]}` ? f.slice(0, 3).join('/') : tpl;
}

/** The licences, interned: there are a dozen of them across thousands of photographs. */
const LICENCES = [];
function licenceCode(name) {
  let at = LICENCES.indexOf(name);
  if (at < 0) { LICENCES.push(name); at = LICENCES.length - 1; }
  return at;
}

function photoTemplate(url) {
  const raw = url.split('?')[0].split('/wikipedia/commons/thumb/')[1];
  if (!raw) return null;
  const parts = raw.split('/');
  const last = parts.length - 1;
  if (!/\d+px-/.test(parts[last])) return null;
  parts[last] = parts[last].replace(/\d+px-/, '{w}px-');
  return parts.join('/');
}

async function main() {
  console.log('Harvesting from iNaturalist…');
  const taxa = await harvest();

  console.log('Reading the family tree…');
  const tree = await ancestors(taxa);

  // work out the shelf for the ones that came in by name, and collect the family and the order
  for (const t of taxa) {
    const ids = t.ancestor_ids ?? [];
    if (!t.group) {
      for (const [id, g] of GROUP_OF_ANCESTOR) if (ids.includes(id)) { t.group = g; break; }
    }
    t.chain = [t.name, ...ids.slice().reverse().map(i => tree.get(i)?.name).filter(Boolean)];
    for (const i of ids) {
      const a = tree.get(i);
      if (!a) continue;
      if (a.rank === 'family') t.family = a;
      if (a.rank === 'order') t.order = a;
      if (a.rank === 'class') t.klass = a;
    }
  }
  const usable = taxa.filter(t => t.group && t.wikipedia_url);
  console.log(`  ${usable.length} of ${taxa.length} have a shelf and a Wikipedia page`);

  console.log('Asking Wikipedia…');
  const titles = [...new Set(usable.map(t => decodeURIComponent(t.wikipedia_url.split('/wiki/')[1] ?? '').replace(/_/g, ' ')))].filter(Boolean);
  const meta = await wikiMeta(titles);
  const enText = await extracts('en.wikipedia.org', [...new Set([...meta.values()].map(m => m.title))], 'english text');
  const nlTitles = [...new Set([...meta.values()].map(m => m.nlTitle).filter(Boolean))];
  const nlText = await extracts('nl.wikipedia.org', nlTitles, 'dutch text');
  // the Dutch article often leads with a different photograph, which is the second chance for a
  // species whose English one is under a licence this project will not ship
  const nlMeta = await wikiMeta(nlTitles, 'nl.wikipedia.org', false, 'dutch pages');

  console.log('Checking the photographs…');
  const files = [...new Set([
    ...[...meta.values()].map(m => m.file),
    ...[...nlMeta.values()].map(m => m.file),
  ].filter(Boolean))];
  const lic = await licences(files);

  console.log('Asking GBIF where they live…');
  const names = usable.map(t => t.name);
  const continents = await where(names);

  console.log('Writing the book…');
  const species = [];
  const dropped = { photo: 0, licence: 0, name: 0, notForChildren: 0 };
  usable.forEach((t, i) => {
    const title = decodeURIComponent(t.wikipedia_url.split('/wiki/')[1] ?? '').replace(/_/g, ' ');
    const m = meta.get(title);
    if (!m) { dropped.photo++; return; }
    // the English article's photograph first, then the Dutch one; whichever has a licence we may
    // actually ship, and nothing at all if neither does
    const pick = [m, m.nlTitle ? nlMeta.get(m.nlTitle) : null]
      .map(c => {
        if (!c?.thumb || !c.thumb.includes('/wikipedia/commons/thumb/')) return null;
        const tpl = photoTemplate(c.thumb);
        const l = c.file ? lic.get(c.file) : null;
        return tpl && l && FREE.test(l.lic) ? { tpl, l } : null;
      })
      .find(Boolean);
    if (!pick) {
      if (!m.thumb) dropped.photo++; else dropped.licence++;
      return;
    }
    const { tpl, l } = pick;

    if (NOT_FOR_CHILDREN.includes(t.name)) { dropped.notForChildren++; return; }

    const nl = tidyName(t.preferred_common_name) || tidyName(m.nlTitle);
    const en = tidyName(t.english_common_name) || tidyName(m.title);
    if (!nl && !en) { dropped.name++; return; }

    const chain = t.chain;
    const size = lookUp(SIZE_CM, chain);
    const diet = lookUp(DIET, chain);
    const hab = lookUp(HABITAT, chain);
    const exact = SIZE_CM[t.name] !== undefined;

    species.push({
      i: t.id,
      n: nl || en,
      e: en || nl,
      s: t.name,
      g: t.group,
      f: t.family ? tidyName(t.family.nl) || t.family.name : '',
      fe: t.family ? tidyName(t.family.en) || t.family.name : '',
      p: shortPath(tpl),
      c: l.who || 'Wikimedia Commons',
      l: licenceCode(l.lic),
      d: trimTo(nlText.get(m.nlTitle ?? '') ?? '', 300),
      D: trimTo(enText.get(m.title) ?? '', 300),
      w: continents[i] ?? [],
      h: hab ?? '',
      t: diet ?? '',
      z: size ?? 0,
      x: exact ? 1 : 0,
      r: STATUS[t.conservation_status?.status_name?.toUpperCase?.()] ?? STATUS[(t.conservation_status?.status ?? '').toUpperCase()] ?? '',
      o: t.observations_count ?? 0,
    });
  });

  species.sort((a, b) => b.o - a.o);

  // Each shelf keeps its own most-photographed, which is also its most-recognisable - plus every
  // famous animal, however rarely anyone meets one. A book a child can carry beats a longer one
  // they have to wait for.
  const CAP = { mam: 430, bir: 470, fis: 420, rep: 310, amp: 230, but: 470, ins: 650, spi: 200, sea: 560 };
  const famous = new Set(MUST_HAVE);
  const kept = [];
  const room = { ...CAP };
  for (const sp of species) {
    if (famous.has(sp.s)) { kept.push(sp); room[sp.g] = (room[sp.g] ?? 0) - 1; continue; }
    if ((room[sp.g] ?? 0) <= 0) continue;
    room[sp.g]--;
    kept.push(sp);
  }
  species.length = 0;
  species.push(...kept);

  const counts = {};
  for (const s of species) counts[s.g] = (counts[s.g] ?? 0) + 1;

  // The two paragraphs are more than half the weight and only one language is ever wanted, so
  // they travel in their own files and are fetched after the grid is already on screen.
  const nlOut = {}, enOut = {};
  for (const s of species) {
    if (s.d) nlOut[s.i] = s.d;
    if (s.D) enOut[s.i] = s.D;
    delete s.d; delete s.D;
  }

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify({
    v: 1,
    built: new Date().toISOString().slice(0, 10),
    base: 'https://upload.wikimedia.org/wikipedia/commons/thumb/',
    licences: LICENCES,
    sources: ['iNaturalist', 'Wikipedia', 'Wikimedia Commons', 'GBIF'],
    species,
  }));
  writeFileSync(join(dirname(OUT), 'text-nl.json'), JSON.stringify(nlOut));
  writeFileSync(join(dirname(OUT), 'text-en.json'), JSON.stringify(enOut));

  const kb = Math.round(readFileSync(OUT).length / 1024);
  const kbNl = Math.round(readFileSync(join(dirname(OUT), 'text-nl.json')).length / 1024);
  const kbEn = Math.round(readFileSync(join(dirname(OUT), 'text-en.json')).length / 1024);
  console.log(`\n${species.length} species written to public/animals/animals.json (${kb} kB, text ${kbNl}/${kbEn} kB)`);
  console.log('  per shelf:', counts);
  console.log(`  dropped: ${dropped.photo} with no free photograph, ${dropped.licence} with a licence we may not use, ${dropped.name} with no name, ${dropped.notForChildren} not for children`);
  console.log(`  with a Dutch paragraph: ${Object.keys(nlOut).length}, english: ${Object.keys(enOut).length}`);
  console.log(`  with a size: ${species.filter(s => s.z).length}, a diet: ${species.filter(s => s.t).length}, a place: ${species.filter(s => s.w.length).length}`);
}

main().catch(e => { console.error(e); process.exit(1); });
