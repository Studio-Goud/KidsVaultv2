/**
 * Re-record a short line inside a sentence, and keep only the line.
 *
 * `voicehear.mjs` found that Ruth's recordings of very short texts are sometimes simply another
 * word: handed "roos" and nothing else, the speech engine has no context and guesses. Handed "Het
 * woord is: roos." it says "roos". So this asks for the whole sentence, with the time each letter
 * is spoken (`with-timestamps`), cuts out exactly the part that is the line, fades its edges so
 * there is no click, and writes it over the old recording under the same file name - the manifest
 * does not change, only the sound and its length.
 *
 * Same voice, model and settings as `voice.mjs`, on the build machine, key from ELEVENLABS_API_KEY.
 *
 *   node scripts/voicefix.mjs --from-report [--below 0.6] [--lang nl]   every line voicehear flagged
 *   node scripts/voicefix.mjs --text "roos" [--text "haai"]              just these
 *   add --dry to see what would be done
 *
 * Afterwards run `node scripts/voicehear.mjs` again: the re-recorded files are listened to afresh.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { Mp3Encoder } from '@breezystack/lamejs';

const args = process.argv.slice(2);
const arg = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const LANG = arg('--lang') === 'en' ? 'en' : 'nl';
const DRY = args.includes('--dry');
const BELOW = Number(arg('--below') ?? 0.6);
const RATE = 22050;
const MANIFEST = 'public/voice/clips.json';

const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
const voice = (typeof manifest._voice === 'object' ? manifest._voice[LANG] : manifest._voice), model = manifest._model;
const byText = new Map(Object.values(manifest[LANG]).map(c => [c.text, c]));

let texts = [];
for (let i = 0; i < args.length; i++) if (args[i] === '--text') texts.push(args[i + 1]);
// The bare sounds of Letterbos ("mmm", "ah", "buh") are not words and a sentence does not help
// them: "Het woord is: mmm" is still a guess. They are left out here and handled on their own.
const SOUND_SAYS = new Set([...readFileSync('src/games/letters/phonics.ts', 'utf8').matchAll(/say: '([^']+)'/g)].map(m => m[1]));
if (args.includes('--from-report')) {
  const rows = JSON.parse(readFileSync(`.cache/voicehear-${LANG}${args.includes('--context') ? '-ctx' : ''}-report.json`, 'utf8'));
  texts.push(...rows.filter(r => r.score < BELOW && !SOUND_SAYS.has(r.text)).map(r => r.text));
}
texts = [...new Set(texts)].filter(t => byText.has(t));
console.log(`${texts.length} lines to re-record${DRY ? ' (dry run)' : ''}`);
if (DRY) { for (const t of texts) console.log(' ', t); process.exit(0); }

const key = process.env.ELEVENLABS_API_KEY;
if (!key) { console.error('ELEVENLABS_API_KEY is not set.'); process.exit(2); }

/** Units written the short way, said the long way: "km/u" is not a word to guess at. */
const readable = t => (LANG === 'nl'
  ? t.replace(/\bkm\/u\b/g, 'kilometer per uur').replace(/\bkm\/h\b/g, 'kilometer per uur').replace(/\bkm\/s\b/g, 'kilometer per seconde').replace(/\bm\/s\b/g, 'meter per seconde').replace(/\bkm\b/g, 'kilometer')
  : t.replace(/\bkm\/h\b/g, 'kilometres per hour').replace(/\bkm\/s\b/g, 'kilometres per second').replace(/\bm\/s\b/g, 'metres per second').replace(/\bkm\b/g, 'kilometres'));

/** The sentence the line is said in. It ends on the line, so the line gets a natural fall. */
const carrier = t => (LANG === 'nl' ? `Het woord is: ${readable(t)}.` : `The word is: ${readable(t)}.`);

async function speak(text) {
  const body = { text, model_id: model, voice_settings: { stability: 0.55, similarity_boost: 0.8, style: 0.15, use_speaker_boost: true } };
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}/with-timestamps?output_format=pcm_${RATE}`, {
      method: 'POST', headers: { 'xi-api-key': key, 'content-type': 'application/json' }, body: JSON.stringify(body),
    });
    if (r.ok) return r.json();
    if (r.status === 429 || r.status >= 500) { await new Promise(res => setTimeout(res, 2500 * (attempt + 1))); continue; }
    throw new Error(`${r.status} ${(await r.text()).slice(0, 300)}`);
  }
  throw new Error('gave up after three tries');
}

/** Cut [from, to] seconds out of 16-bit mono PCM, with short fades so the edges do not click. */
function cut(pcm, from, to) {
  const a = Math.max(0, Math.floor(from * RATE)), b = Math.min(pcm.length, Math.ceil(to * RATE));
  const out = pcm.slice(a, b);
  const fin = Math.floor(0.012 * RATE), fout = Math.floor(0.06 * RATE);
  for (let i = 0; i < fin && i < out.length; i++) out[i] = Math.round(out[i] * (i / fin));
  for (let i = 0; i < fout && i < out.length; i++) out[out.length - 1 - i] = Math.round(out[out.length - 1 - i] * (i / fout));
  return out;
}

function mp3(pcm) {
  const enc = new Mp3Encoder(1, RATE, 32);
  const parts = [];
  for (let i = 0; i < pcm.length; i += 1152) { const b = enc.encodeBuffer(pcm.subarray(i, i + 1152)); if (b.length) parts.push(Buffer.from(b)); }
  const end = enc.flush(); if (end.length) parts.push(Buffer.from(end));
  return Buffer.concat(parts);
}

// what voicehear heard of the old recordings is no longer true of the new ones
const HEARDS = [`.cache/voicehear-${LANG}.json`, `.cache/voicehear-${LANG}-ctx.json`];
const hearings = HEARDS.map(f => (existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : {}));

let done = 0, failed = 0;
const queue = [...texts];
async function one(t) {
  const clip = byText.get(t);
  try {
    const sentence = carrier(t);
    const j = await speak(sentence);
    const al = j.alignment ?? j.normalized_alignment;
    const chars = al.characters.join('');
    const said = readable(t);
    const at = chars.lastIndexOf(said);
    if (at < 0) throw new Error(`the line is not in the alignment: ${chars}`);
    const start = al.character_start_times_seconds[at];
    const end = al.character_end_times_seconds[at + said.length - 1];
    const raw = Buffer.from(j.audio_base64, 'base64');
    const pcm = new Int16Array(raw.buffer, raw.byteOffset, Math.floor(raw.length / 2));
    // a little before the first letter (the timestamps run slightly late) and a breath after the last
    const piece = cut(Int16Array.from(pcm), start - 0.05, end + 0.18);
    writeFileSync(`public/voice/${clip.file}`, mp3(piece));
    clip.secs = Math.round((piece.length / RATE) * 10) / 10;
    for (const h of hearings) delete h[clip.file];
    done++;
    if (done % 50 === 0) console.log(`${done} re-recorded`);
  } catch (e) {
    failed++;
    console.log(`??  ${t}  ${String(e).slice(0, 160)}`);
  }
}
await Promise.all(Array.from({ length: 3 }, async () => { while (queue.length) await one(queue.shift()); }));
writeFileSync(MANIFEST, JSON.stringify(manifest));
HEARDS.forEach((f, i) => writeFileSync(f, JSON.stringify(hearings[i])));
console.log(`${done} re-recorded, ${failed} failed`);
