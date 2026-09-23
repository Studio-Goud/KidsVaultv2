/**
 * Suri's voice, rendered once on this machine and shipped as audio files.
 *
 * The owner wants a natural woman's voice instead of whatever the phone happens to have, and has
 * an ElevenLabs account for it. This script is the whole of that pipeline, and it runs here and
 * never on a phone: every line is sent to ElevenLabs once, the mp3 lands in `public/voice/nl/`,
 * and from then on the app plays a file. Nothing about a child is in any of it - these are the
 * app's own sentences - and the app itself still makes no request anywhere (rule 1 in CLAUDE.md).
 *
 * The key is read from the environment as ELEVENLABS_API_KEY and never written anywhere.
 *
 *   node scripts/voice.mjs voices              Dutch women's voices to choose from
 *   node scripts/voice.mjs sample <id> [<id>]  five Suri lines per voice, in .cache/voice-samples
 *   node scripts/voice.mjs render <id> [--dry] every line not yet recorded, and the manifest
 *
 * Which lines: every Dutch string the source holds as a sentence - the second half of each
 * `T(en, nl)` and every `...Nl:` field - found by reading the source with the TypeScript parser.
 * That is more than is ever said out loud, and the extra costs a few credits and nothing else. What
 * it cannot find is a line assembled at runtime ("acht plus vijf is dertien"); those stay on the
 * device's voice. Recordings are filed under `lineKey()` from `src/platform/voicekey.ts`, which the
 * app uses to look them up, so a line whose words change simply falls back until this runs again.
 */

import ts from 'typescript';
import { build } from 'esbuild';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const API = 'https://api.elevenlabs.io';
const MANIFEST = 'public/voice/clips.json';
const OUT = 'public/voice/nl';
/** the model: multilingual v2 is ElevenLabs' steadiest for long-form Dutch. Override with --model */
const MODEL = arg('--model') ?? 'eleven_multilingual_v2';
/** 32 kbit/s mono at 22 kHz: a voice on a phone speaker needs no more, and 700 lines ship inside the app */
const FORMAT = 'mp3_22050_32';
const KBPS = 32;

const SAMPLES = [
  'Hoi, ik ben Suri. Zullen we samen iets gaan doen?',
  'Tik op de klokjes. Of strijk er met je vinger overheen.',
  'Schuif de twee kisten tegen elkaar en tel alle appels.',
  'Een witte haai kan zo’n zes meter lang worden. Dat is langer dan een auto.',
  'Dit wordt je laatste spelletje van vandaag. Kies maar een leuke.',
];

function arg(name) {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
}

function key() {
  const k = process.env.ELEVENLABS_API_KEY;
  if (!k) {
    console.error('ELEVENLABS_API_KEY is not set. Add it to the environment; never paste it into a file here.');
    process.exit(2);
  }
  return k;
}

async function api(path, opts = {}) {
  for (let attempt = 0; ; attempt++) {
    const r = await fetch(API + path, { ...opts, headers: { 'xi-api-key': key(), ...(opts.headers ?? {}) } });
    // busy is not broken: wait and try again, a few times
    if ((r.status === 429 || r.status >= 500) && attempt < 5) {
      await new Promise(res => setTimeout(res, 1500 * 2 ** attempt));
      continue;
    }
    return r;
  }
}

async function lineKeyFn() {
  const dir = mkdtempSync(join(tmpdir(), 'suri-voice-'));
  const file = join(dir, 'voicekey.mjs');
  await build({ entryPoints: ['src/platform/voicekey.ts'], bundle: true, format: 'esm', outfile: file, logLevel: 'warning' });
  const mod = await import(file);
  rmSync(dir, { recursive: true, force: true });
  return mod;
}

/**
 * Letterbos' own material: its words, its sentences whole and word by word, and every sound it
 * says - which is data rather than sentences in the source, so the parser above never sees it.
 */
async function letterbos() {
  const dir = mkdtempSync(join(tmpdir(), 'suri-letters-'));
  const file = join(dir, 'letters.mjs');
  await build({
    stdin: { contents: "export * from './src/games/letters/words.ts'; export * from './src/games/letters/phonics.ts';", resolveDir: process.cwd(), loader: 'ts' },
    bundle: true, format: 'esm', outfile: file, logLevel: 'warning',
  });
  const L = await import(file);
  rmSync(dir, { recursive: true, force: true });
  return [
    ...L.WORDS.map(w => w.w),
    ...L.LADDERS.flat(),
    ...L.SENTENCES.map(x => x.nl.join(' ')),
    ...L.SENTENCE_WORDS,
    ...L.UNITS.map(u => L.sayOf(u)),
    ...L.UNITS.map(u => L.exampleLine(u, true)),
    // lines that carry a number, said with every number they can carry
    ...Array.from({ length: 12 }, (_, i) => `Vind eerst ${i + 1} fossielen.`),
  ];
}

/** Every Dutch sentence in the source. */
function harvest(extra = []) {
  const files = [];
  const walk = d => {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (p.endsWith('.ts')) files.push(p);
    }
  };
  walk('src');
  const lines = new Set();
  const lit = n => ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n);
  for (const f of files) {
    const sf = ts.createSourceFile(f, readFileSync(f, 'utf8'), ts.ScriptTarget.Latest, true);
    const visit = n => {
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'T'
        && n.arguments.length === 2 && lit(n.arguments[1])) lines.add(n.arguments[1].text);
      if (ts.isPropertyAssignment(n) && /Nl$/.test(n.name.getText(sf)) && lit(n.initializer)) lines.add(n.initializer.text);
      // `NL() ? 'Dutch' : 'English'`, and the same with a plain `nl` flag
      if (ts.isConditionalExpression(n) && lit(n.whenTrue)
        && ((ts.isCallExpression(n.condition) && n.condition.expression.getText(sf) === 'NL')
          || (ts.isIdentifier(n.condition) && n.condition.text === 'nl'))) lines.add(n.whenTrue.text);
      // Moonshot says "<mission> - <speed> m/s als de brandstof op is" for every rung of its ladder
      if (f.endsWith(join('moonshot', 'design.ts')) && ts.isObjectLiteralExpression(n)) {
        const get = k => n.properties.find(pr => ts.isPropertyAssignment(pr) && pr.name.getText(sf) === k);
        const sp = get('speed'), nm = get('nameNl');
        if (sp && nm && ts.isNumericLiteral(sp.initializer) && lit(nm.initializer)) {
          lines.add(`${nm.initializer.text} - ${sp.initializer.text} m/s als de brandstof op is`);
        }
      }
      // Stroomkring says "<part> gedraaid." when a part with a plus and a minus is turned round
      if (f.endsWith(join('circuit', 'sim.ts')) && ts.isPropertyAssignment(n) && n.name.getText(sf) === 'nameNl'
        && lit(n.initializer)) lines.add(`${n.initializer.text} gedraaid.`);
      // a row whose Dutch field is simply `nl` (the animal groups)
      if (ts.isPropertyAssignment(n) && n.name.getText(sf) === 'nl' && lit(n.initializer)) lines.add(n.initializer.text);
      // a table of Dutch names, `const CONTINENT_NL = { eu: 'Europa' }`
      if (ts.isVariableDeclaration(n) && /_NL$/.test(n.name.getText(sf)) && n.initializer
        && ts.isObjectLiteralExpression(n.initializer)) {
        for (const pr of n.initializer.properties) if (ts.isPropertyAssignment(pr) && lit(pr.initializer)) lines.add(pr.initializer.text);
      }
      // the Dutch half of an old-style dictionary, `const nl = { key: '...' }` (src/i18n.ts)
      if (ts.isVariableDeclaration(n) && n.name.getText(sf) === 'nl' && n.initializer
        && ts.isObjectLiteralExpression(n.initializer)) {
        for (const pr of n.initializer.properties) if (ts.isPropertyAssignment(pr) && lit(pr.initializer)) lines.add(pr.initializer.text);
      }
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }
  // Short labels are kept too: the first run left them out as "read, not said", and then the animal
  // book said "Zoeken" and the night sky said "Kijk goed" in the phone's voice. A label costs a few
  // credits; a gap costs a second voice.
  return [...new Set([...lines, ...extra].map(s => s.replace(/\s+/g, ' ').trim()))]
    .filter(s => /[a-zà-ÿ]/i.test(s) && !/[<>{}]/.test(s))
    .sort();
}

/**
 * What the voice is actually given to read. The line is still filed under its own words; only the
 * reading changes, because "m/s" read letter by letter is not what anybody would say to a child.
 */
const readable = text => text
  .replace(/(\d)\s*m\/s\b/g, '$1 meter per seconde')
  .replace(/(\d)\s*km\/s\b/g, '$1 kilometer per seconde')
  .replace(/(\d)\s*km\/h\b/g, '$1 kilometer per uur')
  .replace(/(\d)\s*×/g, '$1 keer');

async function tts(voice, text) {
  const body = {
    text: readable(text),
    model_id: MODEL,
    // steady rather than theatrical: the same line should sound the same every time a child hears it
    voice_settings: { stability: 0.55, similarity_boost: 0.8, style: 0.15, use_speaker_boost: true },
  };
  if (MODEL !== 'eleven_multilingual_v2') body.language_code = 'nl';
  const r = await api(`/v1/text-to-speech/${voice}?output_format=${FORMAT}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 300)}`);
  return Buffer.from(await r.arrayBuffer());
}

async function voices() {
  const own = await (await api('/v1/voices')).json();
  const mine = (own.voices ?? []).map(v => ({
    id: v.voice_id, name: v.name, where: 'eigen', gender: v.labels?.gender ?? '', lang: v.labels?.language ?? v.labels?.accent ?? '',
  }));
  const lib = await (await api('/v1/shared-voices?language=nl&gender=female&page_size=30&sort=usage_character_count_1y')).json();
  const shared = (lib.voices ?? []).map(v => ({
    id: v.voice_id, name: v.name, where: 'bibliotheek', gender: v.gender ?? '', lang: `${v.language ?? ''} ${v.accent ?? ''}`.trim(),
    note: (v.description ?? '').slice(0, 80), owner: v.public_owner_id,
  }));
  for (const v of [...mine, ...shared]) {
    console.log(`${v.id}  ${v.where.padEnd(11)} ${v.gender.padEnd(7)} ${v.lang.padEnd(16)} ${v.name}${v.note ? ` - ${v.note}` : ''}`);
  }
}

async function sample(ids) {
  const dir = '.cache/voice-samples';
  mkdirSync(dir, { recursive: true });
  const rows = [];
  for (const id of ids) {
    for (let i = 0; i < SAMPLES.length; i++) {
      const file = `${id}-${i + 1}.mp3`;
      writeFileSync(join(dir, file), await tts(id, SAMPLES[i]));
      rows.push(`<p><b>${id}</b> ${i + 1}: ${SAMPLES[i]}<br><audio controls src="${file}"></audio></p>`);
      console.log(`${id} ${i + 1}/${SAMPLES.length}`);
    }
  }
  writeFileSync(join(dir, 'index.html'), `<meta charset="utf-8"><title>Suri - stemproef</title>${rows.join('\n')}`);
  console.log(`\n${rows.length} samples in ${dir}`);
}

async function render(voice, dry) {
  const { lineKey } = await lineKeyFn();
  const all = harvest(await letterbos());
  const raw = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : {};
  // a different voice or model means every recording is out of date, so start again
  const same = raw._voice === voice && raw._model === MODEL;
  const kept = same ? (raw.nl ?? []).filter(c => existsSync(join('public/voice', c.file))) : [];
  const have = new Set(kept.map(c => c.id));
  const todo = all.filter(t => !have.has(lineKey(t)));
  const chars = todo.reduce((a, t) => a + t.length, 0);
  console.log(`${all.length} lines, ${kept.length} already recorded, ${todo.length} to do, ${chars} characters`);
  if (dry || !todo.length) return;

  mkdirSync(OUT, { recursive: true });
  const rows = [...kept];
  const save = () => writeFileSync(MANIFEST, JSON.stringify({
    _: 'Recorded lines, rendered by scripts/voice.mjs. Filed under lineKey() of their words; a line not in here falls back to the device voice. See docs/voice.md.',
    _voice: voice, _model: MODEL,
    nl: rows.sort((a, b) => a.id.localeCompare(b.id)),
    en: raw.en ?? [],
  }, null, 1) + '\n');

  let done = 0, failed = 0;
  const queue = todo.slice();
  const worker = async () => {
    for (let t = queue.shift(); t !== undefined; t = queue.shift()) {
      const id = lineKey(t);
      try {
        const mp3 = await tts(voice, t);
        writeFileSync(join(OUT, `${id}.mp3`), mp3);
        rows.push({ id, file: `nl/${id}.mp3`, secs: Math.round((mp3.length * 8 / (KBPS * 1000)) * 10) / 10, text: t });
      } catch (e) {
        failed++;
        console.error(`\n  failed: ${t.slice(0, 60)} - ${String(e.message).slice(0, 160)}`);
      }
      done++;
      // written as it goes, so a run that is stopped halfway keeps what it paid for
      if (done % 20 === 0) { save(); process.stdout.write(`\r${done}/${todo.length}`); }
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  save();
  console.log(`\r${done - failed} recorded, ${failed} failed`);
}

const [cmd, ...rest] = process.argv.slice(2).filter((a, i, all) => !a.startsWith('--') && !(all[i - 1] ?? '').startsWith('--model'));
if (cmd === 'voices') await voices();
else if (cmd === 'sample' && rest.length) await sample(rest);
else if (cmd === 'render' && rest[0]) await render(rest[0], process.argv.includes('--dry'));
else if (cmd === 'lines') for (const l of harvest(await letterbos())) console.log(l);
else {
  console.log('node scripts/voice.mjs voices | sample <voiceId>... | render <voiceId> [--dry] | lines');
  process.exit(cmd ? 1 : 0);
}
