/**
 * Listen to Ruth's recordings and check she said what was written.
 *
 * `voicecheck` and `voicecrawl` prove a line *has* a recording. They cannot tell whether the
 * recording says the right thing, and it turned out that it sometimes does not: a speech engine
 * handed a very short text - one word, one sound - has little to go on and guesses. The owner heard
 * "roos" come out as something like "bloesem", and the isolated sounds of Letterbos as other sounds.
 * Nobody here can listen to six thousand files, so this script has them transcribed (ElevenLabs'
 * speech-to-text, on the build machine, like the rendering) and lays the transcript next to the
 * text. A transcript that is far from the text is a recording to re-render or to look at.
 *
 * Nothing about a child is in any of it: these are the app's own sentences, as in `voice.mjs`. The
 * key is read from ELEVENLABS_API_KEY and never written anywhere.
 *
 *   node scripts/voicehear.mjs [--max-words 3] [--lang nl] [--only <text>]   transcribe, then report
 *   node scripts/voicehear.mjs --report                                        report from the cache
 *
 * Transcripts are kept in .cache/voicehear-<lang>.json by file name, so a second run only listens to
 * what is new or re-rendered. Latin names and single sounds make noisy transcripts; the report
 * sorts by how far off each one is, so the real misreadings are at the top.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const arg = name => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined; };
const LANG = arg('--lang') === 'en' ? 'en' : 'nl';
const MAX = Number(arg('--max-words') ?? 3);
const ONLY = arg('--only');
const REPORT = process.argv.includes('--report');
// With --context every clip is heard after a short spoken lead-in in the same voice ("Het woord
// is:"). A speech recogniser handed one bare word guesses the language as well as the word - "sok"
// came back as Russian, "noot" as "note" - and the lead-in settles the language, so what is left
// to disagree about is the word. MP3 frames of the same format can simply be put one after another.
const CONTEXT = process.argv.includes('--context');
const LEAD = LANG === 'nl' ? 'Het woord is:' : 'The word is:';
const CACHE = `.cache/voicehear-${LANG}${CONTEXT ? '-ctx' : ''}.json`;

const manifest = JSON.parse(readFileSync('public/voice/clips.json', 'utf8'));
const clips = Object.values(manifest[LANG]).filter(c => (ONLY ? c.text === ONLY : c.text.split(/\s+/).length <= MAX));
mkdirSync('.cache', { recursive: true });
const heard = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : {};

/** Lower case, no accents, no punctuation: what is left is what a listener would compare. */
export const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

/** How alike two texts are, 0..1, by edit distance over the longer one. */
export function alike(a, b) {
  a = norm(a).replace(/ /g, ''); b = norm(b).replace(/ /g, '');
  if (!a && !b) return 1;
  const m = a.length, n = b.length, d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return 1 - d[m][n] / Math.max(m, n);
}

let lead = null;
async function leadIn(key) {
  if (lead) return lead;
  const file = `.cache/voicehear-lead-${LANG}.mp3`;
  if (!existsSync(file)) {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${manifest._voice}?output_format=mp3_22050_32`, {
      method: 'POST', headers: { 'xi-api-key': key, 'content-type': 'application/json' },
      body: JSON.stringify({ text: LEAD, model_id: manifest._model, voice_settings: { stability: 0.55, similarity_boost: 0.8, style: 0.15, use_speaker_boost: true } }),
    });
    if (!r.ok) throw new Error(`lead-in: ${r.status}`);
    writeFileSync(file, Buffer.from(await r.arrayBuffer()));
  }
  lead = readFileSync(file);
  return lead;
}

/** The transcript without the lead-in, however the recogniser chose to write it. */
const unlead = t => (CONTEXT ? t.replace(LANG === 'nl' ? /^\s*het\s+woord\s+is[\s:,.]*/i : /^\s*the\s+word\s+is[\s:,.]*/i, '') : t);

async function listen(c, key) {
  const form = new FormData();
  form.append('model_id', 'scribe_v1');
  form.append('language_code', LANG === 'nl' ? 'nld' : 'eng');
  form.append('tag_audio_events', 'false');
  const audio = readFileSync(`public/voice/${c.file}`);
  form.append('file', new Blob([CONTEXT ? Buffer.concat([await leadIn(key), audio]) : audio], { type: 'audio/mpeg' }), 'clip.mp3');
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await fetch('https://api.elevenlabs.io/v1/speech-to-text', { method: 'POST', headers: { 'xi-api-key': key }, body: form });
    if (r.ok) return unlead((await r.json()).text ?? '');
    if (r.status === 429 || r.status >= 500) { await new Promise(res => setTimeout(res, 2000 * (attempt + 1))); continue; }
    throw new Error(`${r.status} ${(await r.text()).slice(0, 200)}`);
  }
  throw new Error('gave up after three tries');
}

if (!REPORT) {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) { console.error('ELEVENLABS_API_KEY is not set.'); process.exit(2); }
  const todo = clips.filter(c => heard[c.file] === undefined);
  console.log(`${clips.length} clips, ${todo.length} to listen to`);
  let done = 0, failed = 0;
  const workers = Array.from({ length: 6 }, async () => {
    while (todo.length) {
      const c = todo.shift();
      try { heard[c.file] = await listen(c, key); } catch (e) { failed++; if (failed < 5) console.error(c.text, String(e)); if (failed > 40) { todo.length = 0; } }
      if (++done % 200 === 0) { writeFileSync(CACHE, JSON.stringify(heard)); console.log(`${done} heard`); }
    }
  });
  await Promise.all(workers);
  writeFileSync(CACHE, JSON.stringify(heard));
  console.log(`${done} heard, ${failed} failed`);
}

const rows = clips.filter(c => heard[c.file] !== undefined).map(c => ({ text: c.text, heard: heard[c.file], file: c.file, score: alike(c.text, heard[c.file]) }));
rows.sort((a, b) => a.score - b.score);
const bad = rows.filter(r => r.score < 0.6);
writeFileSync(`.cache/voicehear-${LANG}${CONTEXT ? '-ctx' : ''}-report.json`, JSON.stringify(rows, null, 1));
console.log(`${rows.length} compared, ${bad.length} far off (below 0.6)`);
for (const r of bad.slice(0, Number(arg('--show') ?? 60))) console.log(`${r.score.toFixed(2)}  ${JSON.stringify(r.text)}  ->  ${JSON.stringify(r.heard)}  ${r.file}`);
