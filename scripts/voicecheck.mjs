/**
 * Which lines are said in Ruth's recorded voice, and which still fall back to the phone's.
 *
 * Opens every page as a two- and a six-year-old, presses the first few buttons so the game starts
 * talking, and lists every line it spoke and how. The first run of this found seventeen lines on
 * the phone's voice: opening lines said before the manifest had loaded, short labels the renderer
 * had skipped, and lines put together at runtime. `npm run voicecheck`, with `npm run dev` up.
 *
 * The page's Audio and speechSynthesis are replaced by recorders, so nothing is actually heard.
 */
import { chromium } from 'playwright';
const pages = ['rhythm', 'dig', 'numbers', 'tidepool', 'market', 'nightwatch', 'mill', 'letters', 'reis', 'diepzee', 'orbit', 'puffball', 'clock', 'circuit', 'moonshot', 'atlas', 'animals', 'index'];
const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
let clips = 0, device = 0;
for (const pg of pages) {
  for (const years of [2, 6]) {
    const p = await b.newPage({ viewport: { width: 390, height: 844 }, locale: 'nl-NL' });
    await p.addInitScript(y => {
      window.__years = y;
      window.__heard = [];
      const A = window.Audio;
      window.Audio = function (src) { window.__heard.push(['clip', src]); const a = new A(src); return a; };
      const sp = window.speechSynthesis;
      if (sp) sp.speak = u => window.__heard.push(['device', u.text]);
      // pretend there is a Dutch device voice, so a fallback shows up as one
      if (sp) sp.getVoices = () => [{ name: 'Claire', lang: 'nl-NL', localService: true, default: true, voiceURI: 'c' }];
    }, years);
    await p.goto(`http://localhost:5173/${pg}.html`); await p.waitForTimeout(1500);
    // press the first few buttons so a game starts talking
    for (let k = 0; k < 3; k++) {
      const btns = await p.evaluate(() => { const g = Object.keys(window).filter(x => x.startsWith('__')).map(x => window[x]).find(o => o && o.debugState); return g ? g.debugState().buttons ?? [] : []; });
      const bt = btns.find(x => /^(level:0|start|go|play|next|stop:0)/.test(x.id)) ?? btns[0];
      if (!bt) break;
      await p.mouse.click(bt.x, bt.y); await p.waitForTimeout(1200);
    }
    const heard = await p.evaluate(() => window.__heard);
    for (const [kind, what] of heard) {
      if (kind === 'clip') clips++; else device++;
      console.log(`${pg}@${years} ${kind.padEnd(6)} ${String(what).slice(0, 90)}`);
    }
    await p.close();
  }
}
console.log(`\nclips ${clips}, device ${device}`);
await b.close();
