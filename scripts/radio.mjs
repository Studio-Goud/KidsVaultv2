/**
 * Cloudhopper's radio, recorded: the tower in Ruth's voice, the pilots in an English man's voice.
 *
 * The radio says things like "Skyhawk one two three, cleared to land runway two seven left, wind 12
 * kilometers." Every call is assembled at runtime from a callsign, a runway and a wind speed, so
 * whole calls cannot be recorded. What is recorded are the pieces, in both voices, and the radio
 * (`Radio` in src/util/audio.ts) matches each call against them, longest piece first. Air traffic
 * control reads numbers digit by digit anyway, so the joins sit where a real controller pauses.
 *
 *   ELEVENLABS_API_KEY=... node scripts/radio.mjs [--dry]
 */

import { build } from 'esbuild';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const VOICES = {
  tower: 'yO6w2xlECAQRFP6pX7Hw',   // Ruth, as everywhere else in the app
  pilot: 'iP95p4xoKVk53GoZ742B',   // Chris, from the owner's own ElevenLabs voices
};
const MANIFEST = 'public/voice/radio.json';
const dry = process.argv.includes('--dry');

const src = f => readFileSync(f, 'utf8');
const callsigns = [...new Set([...src('src/game/planes.ts').matchAll(/callsign: '([^']+)'/g)].map(m => m[1]))];
const ports = [...new Set([...src('src/game/realports.ts').matchAll(/name: '([^']+)'/g)].map(m => m[1]))];

const PHRASES = [
  // what a call is made of, in the order main.ts puts it together
  'tower', 'inbound for landing', 'mayday mayday', 'bingo fuel', 'minimum fuel', 'request priority landing',
  'cleared to land helipad', 'cleared to land runway', 'wind', 'kilometers', 'welcome home',
  'emergency services are standing by', 'welcome to', 'taxi to the apron', 'go around', 'I say again',
  'traffic alert', 'traffic', 'turn immediately', 'is going down', 'ditching', 'taxi to gate', 'via alpha',
  'taxi to the apron via alpha', 'pushback approved', 'runway', 'cleared for take-off', 'increase speed',
  'expedite', 'increasing speed', 'reduce speed', 'minimum clean', 'reducing speed', 'TCAS RA',
  'turning to avoid traffic', 'hold present position', 'expect further clearance',
  'left', 'right', 'centre', 'zero', 'one', 'two', 'tree', 'four', 'five', 'six', 'seven', 'eight', 'niner',
  'Wolkenhaven', 'Wolkenhaven Tower',
  ...callsigns, ...ports, ...ports.map(p => `${p} Tower`),
  ...Array.from({ length: 100 }, (_, i) => String(i)),
];

const dir = mkdtempSync(join(tmpdir(), 'suri-radio-'));
await build({ entryPoints: ['src/platform/voicekey.ts'], bundle: true, format: 'esm', outfile: join(dir, 'k.mjs'), logLevel: 'warning' });
const { radioKey } = await import(join(dir, 'k.mjs'));
rmSync(dir, { recursive: true, force: true });

const man = existsSync(MANIFEST) ? JSON.parse(src(MANIFEST)) : {};
const out = { tower: man.tower ?? {}, pilot: man.pilot ?? {} };
const todo = [];
for (const who of Object.keys(VOICES)) {
  for (const p of PHRASES) {
    const k = radioKey(p);
    if (!out[who][k] || !existsSync(join('public/voice', out[who][k]))) todo.push({ who, p, k });
  }
}
console.log(`${PHRASES.length} pieces x 2 voices, ${todo.length} to record, ${todo.reduce((a, t) => a + t.p.length, 0)} characters`);
if (dry || !todo.length) process.exit(0);

const key = process.env.ELEVENLABS_API_KEY;
if (!key) { console.error('ELEVENLABS_API_KEY is not set.'); process.exit(2); }
const save = () => writeFileSync(MANIFEST, JSON.stringify({
  _: 'Cloudhopper radio pieces, rendered by scripts/radio.mjs, keyed by radioKey() in src/platform/voicekey.ts.',
  tower: out.tower, pilot: out.pilot,
}, null, 1) + '\n');

let done = 0, failed = 0;
const worker = async () => {
  for (let t = todo.shift(); t; t = todo.shift()) {
    try {
      let r;
      for (let a = 0; a < 5; a++) {
        r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICES[t.who]}?output_format=mp3_22050_32`, {
          method: 'POST', headers: { 'xi-api-key': key, 'content-type': 'application/json' },
          // a radio call is brisk and level: little style, a steady voice
          body: JSON.stringify({ text: t.p, model_id: 'eleven_multilingual_v2', voice_settings: { stability: 0.6, similarity_boost: 0.8, style: 0.05, use_speaker_boost: true } }),
        });
        if (r.status !== 429 && r.status < 500) break;
        await new Promise(res => setTimeout(res, 1500 * 2 ** a));
      }
      if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 200)}`);
      mkdirSync(join('public/voice/radio', t.who), { recursive: true });
      writeFileSync(join('public/voice/radio', t.who, `${t.k}.mp3`), Buffer.from(await r.arrayBuffer()));
      out[t.who][t.k] = `radio/${t.who}/${t.k}.mp3`;
    } catch (e) { failed++; console.error(`\n  failed: ${t.who} ${t.p} - ${e.message}`); }
    if (++done % 20 === 0) { save(); process.stdout.write(`\r${done}`); }
  }
};
await Promise.all([worker(), worker(), worker()]);
save();
console.log(`\r${done - failed} recorded, ${failed} failed`);
