/**
 * Suri's sound effects, rendered once by ElevenLabs and shipped as files.
 *
 * The companion of `scripts/voice.mjs`, for everything that is not speech. The list of effects and
 * what each is asked for lives in `src/platform/sfxspec.ts`, which the app reads too; this renders
 * every row that has no file yet, or whose prompt has changed since it was rendered, into
 * `public/sfx/<game>/<name>.mp3`, and writes `public/sfx/clips.json`.
 *
 * The key is read from ELEVENLABS_API_KEY and never written anywhere.
 *
 *   node scripts/sfx.mjs [--dry] [--only dig]
 */

import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const MANIFEST = 'public/sfx/clips.json';
const dry = process.argv.includes('--dry');
const only = (() => { const i = process.argv.indexOf('--only'); return i > 0 ? process.argv[i + 1] : null; })();

async function spec() {
  const dir = mkdtempSync(join(tmpdir(), 'suri-sfx-'));
  const file = join(dir, 'sfxspec.mjs');
  await build({ entryPoints: ['src/platform/sfxspec.ts'], bundle: true, format: 'esm', outfile: file, logLevel: 'warning' });
  const mod = await import(file);
  rmSync(dir, { recursive: true, force: true });
  return mod.SFX;
}

const hash = s => createHash('sha1').update(s).digest('hex').slice(0, 10);

async function render(row) {
  const k = process.env.ELEVENLABS_API_KEY;
  if (!k) { console.error('ELEVENLABS_API_KEY is not set.'); process.exit(2); }
  for (let attempt = 0; ; attempt++) {
    const r = await fetch('https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_64', {
      method: 'POST',
      headers: { 'xi-api-key': k, 'content-type': 'application/json' },
      // a prompt influence above the default: these are specific little sounds, not a mood
      body: JSON.stringify({
        text: row.prompt, duration_seconds: Math.max(0.5, row.secs), prompt_influence: 0.6,
        ...(row.loop ? { loop: true } : {}),
      }),
    });
    if ((r.status === 429 || r.status >= 500) && attempt < 5) {
      await new Promise(res => setTimeout(res, 1500 * 2 ** attempt));
      continue;
    }
    if (!r.ok) throw new Error(`${r.status} ${(await r.text()).slice(0, 300)}`);
    return Buffer.from(await r.arrayBuffer());
  }
}

/**
 * The animals that get their own call in the Animal Book. Not all 3744: most of them make no sound
 * a child would know, and the renderer invents one if asked. The best-known mammals and birds, the
 * frogs and toads (not the silent salamanders), and the insects that really buzz or chirp - in the
 * book's own order, which is how often people photograph them.
 */
function animalCalls() {
  const all = JSON.parse(readFileSync('public/animals/animals.json', 'utf8')).species;
  const pick = (g, n, test = () => true) => all.filter(x => x.g === g && test(x)).slice(0, n);
  const chosen = [
    ...pick('mam', 120),
    ...pick('bir', 150),
    ...pick('amp', 40, x => !/salamander|newt|axolotl|caecilian|mudpuppy|siren|hellbender/i.test(x.e)),
    ...pick('ins', 30, x => /\b(bee|bumble bee|cricket|cicada|grasshopper|katydid|mosquito|hornet|wasp)\b/i.test(x.e)),
  ];
  const rows = {};
  for (const x of chosen) {
    const kind = x.g === 'bir' ? 'its call or song' : x.g === 'ins' ? 'the buzzing or chirping it makes' : 'its call';
    rows[`animal.${x.i}`] = {
      prompt: `the natural sound of a ${x.e} (${x.s}), ${kind}, a clear close nature recording of one animal, no music, no voice, no other animals`,
      secs: 3, max: 4,
    };
  }
  return rows;
}

const SFX = { ...(await spec()), ...animalCalls() };
const raw = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : {};
const files = raw.files ?? {};
const prompts = raw.prompts ?? {};
const todo = Object.entries(SFX).filter(([key, row]) =>
  (!only || key.startsWith(`${only}.`))
  && !(files[key] && existsSync(join('public/sfx', files[key])) && prompts[key] === hash(row.prompt + row.secs)));
console.log(`${Object.keys(SFX).length} effects, ${todo.length} to render, ${todo.reduce((a, [, r]) => a + r.secs, 0).toFixed(1)} s`);
if (dry || !todo.length) process.exit(0);

const save = () => {
  mkdirSync('public/sfx', { recursive: true });
  writeFileSync(MANIFEST, JSON.stringify({
    _: 'Recorded sound effects, rendered by scripts/sfx.mjs from src/platform/sfxspec.ts. An effect not in here is synthesised, as it always was.',
    files: Object.fromEntries(Object.entries(files).sort()),
    prompts: Object.fromEntries(Object.entries(prompts).sort()),
  }, null, 1) + '\n');
};

let done = 0, failed = 0;
const queue = todo.slice();
const worker = async () => {
  for (let job = queue.shift(); job; job = queue.shift()) {
    const [key, row] = job;
    const [game, name] = key.split('.');
    const dir = game === 'animal' ? 'animals' : game;
    try {
      const mp3 = await render(row);
      mkdirSync(join('public/sfx', dir), { recursive: true });
      writeFileSync(join('public/sfx', dir, `${name}.mp3`), mp3);
      files[key] = `${dir}/${name}.mp3`;
      prompts[key] = hash(row.prompt + row.secs);
    } catch (e) {
      failed++;
      console.error(`\n  failed: ${key} - ${String(e.message).slice(0, 200)}`);
    }
    done++;
    if (done % 10 === 0) { save(); process.stdout.write(`\r${done}/${todo.length}`); }
  }
};
await Promise.all([worker(), worker(), worker()]);
save();
console.log(`\r${done - failed} rendered, ${failed} failed`);
