/**
 * The sounds of Letterbos, cut out of real words instead of spoken on their own.
 *
 * Handed "mmm", "ah" or "buh" and nothing else, the speech engine guesses, and `voicehear.mjs`
 * showed it guessing wrong: "rrr" came out as "ah", "ei" as "nee". But the same engine says "maan"
 * and "huis" perfectly well, and the aa of maan and the ui of huis are exactly the sounds a child
 * needs. So each sound is taken from its own example word (`example` in phonics.ts), said inside a
 * sentence so the word is said properly, using the time each letter is spoken:
 *
 *   - a vowel is the stretch of the vowel's own letters, a little into its neighbours;
 *   - a consonant that can be held (m, s, f, r ...) is its own stretch, as long as the word gives it;
 *   - a plosive (b, d, k, p, t) is its burst plus the first bit of the vowel after it, because a
 *     plosive on its own is silence with a click - the same "buh" compromise a teacher makes.
 *
 *   node scripts/voicesounds.mjs --try [unit ...]   write candidates to .cache/sounds/ to listen to
 *   node scripts/voicesounds.mjs --apply [unit ...] write them over the recordings the game plays
 *
 * Same voice and settings as voice.mjs; key from ELEVENLABS_API_KEY; the phone never calls it.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { Mp3Encoder } from '@breezystack/lamejs';

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const RATE = 22050;
const manifest = JSON.parse(readFileSync('public/voice/clips.json', 'utf8'));
const byText = new Map(Object.values(manifest.nl).map(c => [c.text, c]));

// the table itself, read from the source so this can never drift from what the game says
const src = readFileSync('src/games/letters/phonics.ts', 'utf8');
const SOUNDS = {};
for (const m of src.matchAll(/^\s+(\w+): \{ say: '([^']+)', phoneme: '[^']+', example: '([^']+)', kind: '(\w+)' \}/gm)) SOUNDS[m[1]] = { say: m[2], example: m[3], kind: m[4] };
const PLOSIVE = new Set(['b', 'd', 'k', 'p', 't']);
const units = args.filter(a => !a.startsWith('--') && SOUNDS[a]);
const todo = units.length ? units : Object.keys(SOUNDS);

const key = process.env.ELEVENLABS_API_KEY;
if (!key) { console.error('ELEVENLABS_API_KEY is not set.'); process.exit(2); }

async function speak(text) {
  const body = { text, model_id: manifest._model, voice_settings: { stability: 0.55, similarity_boost: 0.8, style: 0.15, use_speaker_boost: true } };
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${manifest._voice}/with-timestamps?output_format=pcm_${RATE}`, {
    method: 'POST', headers: { 'xi-api-key': key, 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

function cut(pcm, from, to, fadeIn = 0.015, fadeOut = 0.05) {
  const a = Math.max(0, Math.floor(from * RATE)), b = Math.min(pcm.length, Math.ceil(to * RATE));
  const out = Int16Array.from(pcm.subarray(a, b));
  const fi = Math.floor(fadeIn * RATE), fo = Math.floor(fadeOut * RATE);
  for (let i = 0; i < fi && i < out.length; i++) out[i] = Math.round(out[i] * (i / fi));
  for (let i = 0; i < fo && i < out.length; i++) out[out.length - 1 - i] = Math.round(out[out.length - 1 - i] * (i / fo));
  return out;
}

/**
 * Make a sound longer without making it lower: WSOLA, the textbook way. Short overlapping windows
 * are laid down one after another at the new pace, and each is taken from wherever near its place in
 * the original lines up best with what came before, so the waveform never jumps. A held "mmm" or
 * "sss" comes out as a held sound in the same voice, not as a slowed-down tape.
 */
function stretch(pcm, factor) {
  if (factor <= 1.01) return pcm;
  const N = Math.floor(0.03 * RATE), H = N >> 1, tol = Math.floor(0.008 * RATE);
  const outLen = Math.floor(pcm.length * factor);
  const out = new Float32Array(outLen + N), norm = new Float32Array(outLen + N);
  const win = Float32Array.from({ length: N }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N));
  let prev = 0;
  for (let o = 0; o + N < outLen; o += H) {
    const ideal = Math.floor(o / factor);
    let best = Math.min(Math.max(0, ideal), pcm.length - N), bestScore = -Infinity;
    if (o > 0) {
      // the natural continuation of the previous window, compared with each candidate near `ideal`
      const nat = prev + H;
      for (let d = -tol; d <= tol; d++) {
        const c = ideal + d;
        if (c < 0 || c + N > pcm.length || nat + N > pcm.length) continue;
        let sc = 0;
        for (let i = 0; i < N; i += 2) sc += pcm[c + i] * pcm[nat + i];
        if (sc > bestScore) { bestScore = sc; best = c; }
      }
    }
    for (let i = 0; i < N; i++) { out[o + i] += pcm[best + i] * win[i]; norm[o + i] += win[i]; }
    prev = best;
  }
  const res = new Int16Array(outLen);
  for (let i = 0; i < outLen; i++) res[i] = Math.max(-32768, Math.min(32767, Math.round(norm[i] > 1e-3 ? out[i] / norm[i] : 0)));
  return res;
}

/** How long each kind of sound should last when a child hears it on its own. Product choice. */
function targetSecs(unit, kind) {
  if (PLOSIVE.has(unit) || unit === 'ng' || unit === 'nk') return 0;          // as it comes
  if (kind === 'consonant') return 0.5;                                     // held: mmm, sss
  if (['a', 'e', 'i', 'o', 'u'].includes(unit)) return 0.24;                // short vowels stay short
  if (unit.length === 2 && !['ei', 'ij', 'au', 'ou', 'ui'].includes(unit)) return 0.5;  // aa, ee, oe
  return 0.45;                                                              // the glides: ui, ei, eeuw
}

function mp3(pcm) {
  const enc = new Mp3Encoder(1, RATE, 32);
  const parts = [];
  for (let i = 0; i < pcm.length; i += 1152) { const b = enc.encodeBuffer(pcm.subarray(i, i + 1152)); if (b.length) parts.push(Buffer.from(b)); }
  const end = enc.flush(); if (end.length) parts.push(Buffer.from(end));
  return Buffer.concat(parts);
}

mkdirSync('.cache/sounds', { recursive: true });
const out = [];
for (const unit of todo) {
  const s = SOUNDS[unit];
  try {
    const sentence = `Het woord is: ${s.example}.`;
    const j = await speak(sentence);
    const al = j.alignment;
    const chars = al.characters.join('');
    const w = chars.lastIndexOf(s.example);
    const at = w + s.example.indexOf(unit);
    if (w < 0 || s.example.indexOf(unit) < 0) throw new Error(`cannot find ${unit} in ${s.example}`);
    const t0 = al.character_start_times_seconds[at], t1 = al.character_end_times_seconds[at + unit.length - 1];
    const raw = Buffer.from(j.audio_base64, 'base64');
    const pcm = new Int16Array(raw.buffer, raw.byteOffset, Math.floor(raw.length / 2));
    // plosives keep the start of the vowel after them; everything else a sliver either side
    let piece = PLOSIVE.has(unit) ? cut(pcm, t0 - 0.02, t1 + 0.12, 0.004) : cut(pcm, t0 - 0.02, t1 + 0.04, 0.0, 0.0);
    const want = targetSecs(unit, s.kind);
    if (want) piece = stretch(piece, want / (piece.length / RATE));
    // fades after stretching, so the ends are soft whatever the length
    const fi = Math.floor(0.015 * RATE), fo = Math.floor(0.06 * RATE);
    for (let i = 0; i < fi && i < piece.length; i++) piece[i] = Math.round(piece[i] * (i / fi));
    for (let i = 0; i < fo && i < piece.length; i++) piece[piece.length - 1 - i] = Math.round(piece[piece.length - 1 - i] * (i / fo));
    const file = `.cache/sounds/${unit}.mp3`;
    writeFileSync(file, mp3(piece));
    const word = cut(pcm, al.character_start_times_seconds[w] - 0.05, al.character_end_times_seconds[w + s.example.length - 1] + 0.15);
    writeFileSync(`.cache/sounds/${unit}-word.mp3`, mp3(word));
    out.push({ unit, example: s.example, say: s.say, secs: Math.round((piece.length / RATE) * 100) / 100 });
    if (APPLY) {
      const clip = byText.get(s.say);
      if (clip) { writeFileSync(`public/voice/${clip.file}`, readFileSync(file)); clip.secs = Math.max(0.3, Math.round((piece.length / RATE) * 10) / 10); }
    }
    console.log(`ok  ${unit.padEnd(5)} from ${s.example.padEnd(7)} ${(piece.length / RATE).toFixed(2)}s`);
  } catch (e) { console.log(`??  ${unit}  ${String(e).slice(0, 160)}`); }
}
writeFileSync('.cache/sounds/index.json', JSON.stringify(out, null, 1));
if (APPLY) writeFileSync('public/voice/clips.json', JSON.stringify(manifest));
