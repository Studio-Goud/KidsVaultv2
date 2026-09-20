import { chromium } from 'playwright';
const OUT = '/tmp/claude-0/-home-user-KidsVaultv2/2c7558a9-406f-5181-921c-e57081e37e2f/scratchpad/qa3';
const B = 'http://localhost:5180';
const f = c => { c/=255; return c <= 0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4); };
const lum = ([r,g,b]) => 0.2126*f(r)+0.7152*f(g)+0.0722*f(b);
const ratio = (a,b) => { const [x,y]=[lum(a),lum(b)].sort((p,q)=>q-p); return ((x+0.05)/(y+0.05)).toFixed(2); };
const hex = a => '#'+a.map(v=>v.toString(16).padStart(2,'0')).join('');
const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const pg = await br.newPage({ viewport: { width: 390, height: 844 } });
async function tagOf(url, name) {
  await pg.goto(B + url, { waitUntil: 'networkidle' });
  await pg.waitForTimeout(1500);
  await pg.screenshot({ path: `${OUT}/${name}.png` });
  // measure the glyph run itself, not the full-width block - its corners are empty sky
  const box = await pg.evaluate(() => { const e = document.querySelector('.logo .tag'); if (!e) return null;
    const rg = document.createRange(); rg.selectNodeContents(e);
    const r = rg.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) }; });
  if (!box) return console.log(name, 'no .tag');
  // hide the glyphs and shoot the same rectangle, so the background can be measured on its own
  await pg.evaluate(() => { const e = document.querySelector('.logo .tag'); e.dataset.old = e.style.color; e.style.color = 'transparent'; e.style.textShadow = 'none'; });
  await pg.waitForTimeout(120);
  const b64 = (await pg.screenshot({ clip: box })).toString('base64');
  await pg.evaluate(() => { const e = document.querySelector('.logo .tag'); e.style.color = e.dataset.old || ''; e.style.textShadow = ''; });
  const px = await pg.evaluate(async d => {
    const img = new Image(); img.src = 'data:image/png;base64,' + d; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const a = x.getImageData(0,0,c.width,c.height).data; const L = p => 0.2126*p[0]+0.7152*p[1]+0.0722*p[2];
    let lo=null, hi=null;
    for (let i=0;i<a.length;i+=4){ const p=[a[i],a[i+1],a[i+2]]; if(!lo||L(p)<L(lo))lo=p; if(!hi||L(p)>L(hi))hi=p; }
    return { lo, hi };
  }, b64);
  const text = [255, 255, 255];
  console.log(name.padEnd(12), 'white text vs lightest bg', hex(px.hi), '->', ratio(text, px.hi), '| vs darkest bg', hex(px.lo), '->', ratio(text, px.lo));
}
await tagOf('/', 'hub2');
await tagOf('/cloudhopper.html', 'cloud2');
await br.close();
