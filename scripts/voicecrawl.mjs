/**
 * Every line said in the phone's voice instead of Ruth's, found by playing each page at random.
 *
 * The owner asked for Ruth and nothing else. `voicecheck` only listens to the first few taps;
 * this presses ninety random buttons per page, twice, and prints every line that fell back, as
 * collected by `noteMiss()` in src/platform/voice.ts. It is how the dash-joined notes in
 * Stroomkring and Moonshot, the numbered lines in Opgraving and the animal groups were found.
 *
 *   npm run voicecrawl [page ...]      with `npm run dev` up
 */
import { chromium } from 'playwright';
const pages = process.argv.slice(2).length ? process.argv.slice(2) : ['dig', 'rhythm', 'tidepool', 'market', 'nightwatch', 'mill', 'letters', 'reis', 'diepzee', 'orbit', 'puffball', 'numbers', 'clock', 'circuit', 'moonshot', 'atlas', 'animals', 'index', 'parents'];
const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
let total = 0;
for (const pg of pages) {
  for (const seed0 of [7, 101]) {
    const p = await b.newPage({ viewport: { width: 390, height: 844 }, locale: 'nl-NL' });
    await p.addInitScript(() => { window.speechSynthesis.speak = () => {}; });
    await p.goto(`http://localhost:5173/${pg}.html`); await p.waitForTimeout(1500);
    let seed = seed0;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let k = 0; k < 90; k++) {
      const btns = await p.evaluate(() => { const g = Object.keys(window).filter(x => x.startsWith('__')).map(x => window[x]).find(o => o && typeof o.debugState === 'function'); try { return g ? g.debugState().buttons ?? [] : []; } catch { return []; } });
      if (btns.length && rnd() < 0.8) { const bt = btns[Math.floor(rnd() * btns.length)]; await p.mouse.click(bt.x, bt.y); }
      else await p.mouse.click(20 + rnd() * 350, 80 + rnd() * 700);
      await p.waitForTimeout(220);
    }
    const miss = await p.evaluate(() => window.__voiceMisses ?? []);
    total += miss.length;
    if (miss.length) console.log(`${pg}/${seed0}`.padEnd(16), miss.length, JSON.stringify(miss.slice(0, 8)).slice(0, 500));
    await p.close();
  }
}
console.log('total misses', total);
await b.close();
