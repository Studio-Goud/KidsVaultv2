import { displayKmh, runwayAccepts } from '../game/planes';
import type { World } from '../game/world';
import { t } from '../i18n';
import { levelProgress, persist, save } from '../util/storage';
import type { Palette } from './palette';
import { drawHeart, drawPlane, drawPlaneGlyph } from './planes';
import { advise } from '../game/advisory';
import { kindLabel } from '../game/weather';
import { drawWeatherIcon } from './weatherfx';
import { shade } from './palette';
import { UPGRADES, nextCost } from '../game/upgrades';

type Ctx = CanvasRenderingContext2D;

export interface HudLayout { sw: number; sh: number; safeTop: number; safeBottom: number; safeLeft: number; safeRight: number; ui: number }
export interface Rect { x: number; y: number; w: number; h: number }
export interface HudHits { pause: Rect; build?: Rect; slowmo?: Rect; commands?: Array<{ id: string; rect: Rect }>; panel?: Rect; wxToggle?: Rect }

/** Fold the weather detail in or out; the choice is remembered between sessions. */
export function toggleWeatherDetail(): void { save.wxOpen = !save.wxOpen; persist(); }

/**
 * A round button with weight to it: a lip underneath, a lit face, and a sliver of light across
 * the top, the same three things look.ts gives every chunky button in the rest of Bramblewood.
 * Cloudhopper's two round buttons used to be flat discs with a hairline ring, which is what made
 * them the only untouchable-looking buttons in the product.
 */
/** The HUD colours are half-transparent washes; a lit face needs a solid colour to shade. */
function solid(css: string): string {
  const m = /rgba?\(([^)]+)\)/.exec(css);
  if (!m) return css;
  const [r, g, b, a = '1'] = m[1].split(',').map(v => parseFloat(v));
  // over the scene these sit on, so flatten against a mid sky rather than against white
  const f = (c: number, over: number): number => Math.round(c * Number(a) + over * (1 - Number(a)));
  return `#${[f(r, 96), f(g, 132), f(b, 168)].map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('')}`;
}

function chunkyDisc(ctx: Ctx, cx: number, cy: number, r: number, css: string, dim = false): void {
  const tone = solid(css);
  const lip = Math.max(2.5, r * 0.16);
  ctx.save();
  if (dim) ctx.globalAlpha = 0.6;
  ctx.fillStyle = shade(tone, -0.34);
  ctx.beginPath(); ctx.arc(cx, cy + lip * 0.8, r, 0, Math.PI * 2); ctx.fill();
  const g = ctx.createLinearGradient(0, cy - r, 0, cy + r);
  g.addColorStop(0, shade(tone, 0.2));
  g.addColorStop(0.55, tone);
  g.addColorStop(1, shade(tone, -0.1));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.beginPath(); ctx.ellipse(cx, cy - r * 0.42, r * 0.7, r * 0.3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.restore();
}

function roundedCard(ctx: Ctx, x: number, y: number, w: number, h: number, r: number, fill: string): void {
  ctx.fillStyle = fill;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1; ctx.stroke();
}

export function drawCoin(ctx: Ctx, x: number, y: number, r: number): void {
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  g.addColorStop(0, '#fff1a8'); g.addColorStop(0.6, '#ffcf5a'); g.addColorStop(1, '#d99a12');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(120,70,0,0.5)'; ctx.lineWidth = r * 0.12; ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = r * 0.14;
  ctx.beginPath(); ctx.arc(x, y, r * 0.62, 0, Math.PI * 2); ctx.stroke();
}

export function drawHud(ctx: Ctx, world: World, L: HudLayout, time: number, pal: Palette): HudHits {
  const u = L.ui;
  const font = (w: string, s: number): string => `${w} ${Math.round(s * u)}px Nunito, system-ui, sans-serif`;
  const top = L.safeTop + 12 * u;
  const left = L.safeLeft + 12 * u;
  const right = L.sw - L.safeRight - 12 * u;

  // --- counter card ---
  const cw = 156 * u, ch = 72 * u;
  roundedCard(ctx, left, top, cw, ch, 18 * u, pal.hud);
  drawPlaneGlyph(ctx, left + 26 * u, top + 26 * u, 30 * u, '#9fd7ff');
  ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.font = font('800', 10); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillText(t('landed').toUpperCase(), left + 50 * u, top + 20 * u);
  ctx.fillStyle = '#fff'; ctx.font = font('900', 26);
  const num = world.landed.toString();
  ctx.fillText(num, left + 50 * u, top + 44 * u);
  const nw = ctx.measureText(num).width;
  ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = font('800', 13);
  ctx.fillText(world.endless ? t('endless').toLowerCase() : `/ ${world.level.goal}`, left + 54 * u + nw, top + 44 * u);
  // hearts
  for (let i = 0; i < world.maxHearts; i++) drawHeart(ctx, left + 26 * u + i * 15 * u, top + 58 * u, 14 * u, i < world.hearts, '#ff6a8a');
  // best + coins earned
  const best = levelProgress(world.level.id).best;
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = font('900', 11);
  ctx.shadowColor = 'rgba(0,20,50,0.6)'; ctx.shadowBlur = 6 * u;
  ctx.fillText(`${t('best').toUpperCase()}: ${Math.max(best, world.landed)}`, left + 6 * u, top + ch + 16 * u);
  if (world.coinsEarned > 0) {
    drawCoin(ctx, left + 90 * u, top + ch + 12 * u, 6 * u);
    ctx.fillText(`+${world.coinsEarned}`, left + 100 * u, top + ch + 16 * u);
  }
  ctx.shadowBlur = 0;

  // --- pause button ---
  const pr = 22 * u;
  const px = right - pr, py = top + pr;
  chunkyDisc(ctx, px, py, pr, pal.hud);
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.roundRect(px - 7 * u, py - 8 * u, 5 * u, 16 * u, 2 * u); ctx.fill();
  ctx.beginPath(); ctx.roundRect(px + 2 * u, py - 8 * u, 5 * u, 16 * u, 2 * u); ctx.fill();
  const hits: HudHits = { pause: { x: px - pr - 8, y: py - pr - 8, w: pr * 2 + 16, h: pr * 2 + 16 } };

  // --- build button ---
  // The airport is upgraded here, in the middle of the shift, not on a menu tab somewhere else:
  // the coins are on the button, and it glows the moment one of them will buy something.
  if (!world.demo) {
    const br = 22 * u;
    const bx = px, by = py + pr + br + 12 * u;
    const affordable = UPGRADES.some(up => { const c = nextCost(up.id); return c !== null && save.coins >= c; });
    chunkyDisc(ctx, bx, by, br, affordable ? '#2f7a4a' : pal.hud);
    if (affordable) {
      ctx.strokeStyle = 'rgba(124,247,160,0.9)'; ctx.lineWidth = 2 * u;
      ctx.beginPath(); ctx.arc(bx, by, br + 3 * u, 0, Math.PI * 2); ctx.stroke();
    }
    // a terminal with a plus over it: build something here
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.roundRect(bx - 11 * u, by + 1 * u, 22 * u, 10 * u, 2 * u); ctx.fill();
    ctx.fillStyle = affordable ? '#2f7a4a' : shade(pal.hud, -0.25);
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.rect(bx - 7 * u + i * 6 * u, by + 4 * u, 3 * u, 4 * u); ctx.fill(); }
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.roundRect(bx - 2 * u, by - 12 * u, 4 * u, 11 * u, 2 * u); ctx.fill();
    ctx.beginPath(); ctx.roundRect(bx - 7.5 * u, by - 8.5 * u, 15 * u, 4 * u, 2 * u); ctx.fill();
    // the purse, centred under the button so four digits still fit on a narrow phone
    const label = String(save.coins);
    ctx.font = font('900', 12); ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    const lw = ctx.measureText(label).width, cw2 = 12 * u + 4 * u + lw;
    const cx0 = bx - cw2 / 2;
    ctx.shadowColor = 'rgba(0,20,50,0.6)'; ctx.shadowBlur = 6 * u;
    drawCoin(ctx, cx0 + 6 * u, by + br + 9 * u, 6 * u);
    ctx.fillStyle = '#fff';
    ctx.fillText(label, cx0 + 16 * u, by + br + 9 * u);
    ctx.shadowBlur = 0; ctx.textBaseline = 'alphabetic';
    hits.build = { x: bx - br - 8, y: by - br - 8, w: br * 2 + 16, h: br * 2 + 16 };
  }

  // --- weather pill ---
  {
    const wx = world.weather;
    const wy = top + 22 * u;
    const pillW = 150 * u, pillH = 44 * u;
    const x0 = right - 44 * u - 10 * u - pillW;
    roundedCard(ctx, x0, wy - pillH / 2, pillW, pillH, pillH / 2, pal.hud);
    drawWeatherIcon(ctx, wx.kind(), x0 + 22 * u, wy, 22 * u);
    // wind arrow
    const cx = x0 + 50 * u;
    ctx.save(); ctx.translate(cx, wy); ctx.rotate(wx.dirRad);
    ctx.fillStyle = '#bfe9ff';
    ctx.beginPath(); ctx.moveTo(10 * u, 0); ctx.lineTo(-5 * u, -6 * u); ctx.lineTo(-2 * u, 0); ctx.lineTo(-5 * u, 6 * u); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#fff'; ctx.font = font('900', 15); ctx.textAlign = 'left';
    ctx.fillText(`${Math.round(wx.kmhNow)}`, cx + 16 * u, wy + 1 * u);
    ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.font = font('800', 9.5);
    ctx.fillText(t('kmh'), cx + 16 * u, wy + 12 * u);
    ctx.fillStyle = '#fff'; ctx.font = font('900', 13); ctx.textAlign = 'right';
    ctx.fillText(`${Math.round(wx.cur.temp)}°`, x0 + pillW - 12 * u, wy - 2 * u);
    ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.font = font('800', 9.5);
    ctx.fillText(kindLabel(wx.kind()), x0 + pillW - 12 * u, wy + 11 * u);
  }

  // --- slow-motion button (upgrade) ---
  if (world.slowmoMax > 0) {
    const r = 28 * u;
    const bx = right - r, by = L.sh - L.safeBottom - 16 * u - r;
    const active = world.timeScale < 1;
    const avail = world.slowmoCharges > 0 && !active;
    chunkyDisc(ctx, bx, by, r, active ? '#4f80e8' : pal.hud, !avail && !active);
    // hourglass-like tower icon: a clock with slow hand
    ctx.strokeStyle = avail || active ? '#fff' : 'rgba(255,255,255,0.4)'; ctx.lineWidth = 2.2 * u; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(bx, by - 2 * u, 11 * u, 0, Math.PI * 2); ctx.stroke();
    const a = active ? time * 1.5 : -Math.PI / 2;
    ctx.beginPath(); ctx.moveTo(bx, by - 2 * u); ctx.lineTo(bx + Math.cos(a) * 7 * u, by - 2 * u + Math.sin(a) * 7 * u); ctx.stroke();
    for (let i = 0; i < world.slowmoMax; i++) {
      ctx.fillStyle = i < world.slowmoCharges ? '#7cf7a0' : 'rgba(255,255,255,0.3)';
      ctx.beginPath(); ctx.arc(bx - 6 * u + i * 12 * u, by + 15 * u, 3 * u, 0, Math.PI * 2); ctx.fill();
    }
    hits.slowmo = { x: bx - r - 6, y: by - r - 6, w: r * 2 + 12, h: r * 2 + 12 };
  }

  // --- toasts ---
  let ty = top + 96 * u;
  ctx.textAlign = 'center';
  for (const toast of world.toasts) {
    const remain = toast.until - world.time;
    const a = Math.min(1, remain / 0.4);
    ctx.font = font('800', 14);
    const w = ctx.measureText(toast.text).width + 36 * u, h = 34 * u;
    const bg = toast.kind === 'bad' ? 'rgba(200,40,70,0.9)' : toast.kind === 'warn' ? 'rgba(235,150,30,0.92)' : toast.kind === 'good' ? 'rgba(40,170,120,0.92)' : 'rgba(20,40,70,0.75)';
    ctx.globalAlpha = a;
    roundedCard(ctx, L.sw / 2 - w / 2, ty, w, h, h / 2, bg);
    ctx.fillStyle = '#fff'; ctx.fillText(toast.text, L.sw / 2, ty + 22.5 * u);
    ctx.globalAlpha = 1;
    ty += h + 8 * u;
  }

  // --- weather navigation panel for the selected aircraft ---
  const sel = world.selected !== null ? world.planeById(world.selected) : undefined;
  if (sel && sel.state === 'flying' && !world.demo) {
    const adv = advise(world, sel);
    const open = save.wxOpen;
    const rowsN = adv.rows.length;
    // compact by default: aircraft, the four commands, the advice and a fold-out handle.
    // the full weather table only appears when the player asks for it, so the card never
    // swallows the middle of a phone screen.
    const detailH = open ? (20 + rowsN * 15 + 32) * u : 0;
    const w = Math.min(L.sw - 24 * u, 320 * u);
    const h = 172 * u + detailH;
    const x = L.safeLeft + 12 * u, y = L.sh - L.safeBottom - h - 14 * u;
    roundedCard(ctx, x, y, w, h, 20 * u, pal.hud);
    ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, w, h, 20 * u); ctx.clip();
    ctx.translate(x + 32 * u, y + 28 * u);
    const s = (u * 0.82) / Math.max(0.9, sel.type.hull / 22);
    ctx.scale(s, s);
    drawPlane(ctx, { type: sel.type, pos: { x: 0, y: 0 }, heading: -Math.PI / 2, altitude: 1, bank: 0, livery: sel.livery, state: 'flying', id: sel.id }, time, false);
    ctx.restore();
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#fff'; ctx.font = font('900', 13.5);
    ctx.fillText(sel.type.name, x + 62 * u, y + 24 * u, w - 74 * u);
    ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.font = font('700', 10.5);
    const rws = world.runways.filter(r => !r.closed && runwayAccepts(r.kind, sel.type)).map(r => world.runwayName(r));
    ctx.fillText(`${displayKmh(sel.type.speed)} ${t('kmh')} · ${t('landsOn')}: ${rws.join(' / ') || '-'}`, x + 62 * u, y + 40 * u, w - 74 * u);
    hits.panel = { x, y, w, h };
    // ATC command buttons
    const cmds: Array<{ id: string; label: string; active: boolean; enabled: boolean }> = [
      { id: 'faster', label: t('cmdFaster'), active: sel.boost > 1, enabled: sel.boost <= 1 },
      { id: 'slower', label: t('cmdSlower'), active: sel.boost < 1, enabled: sel.boost >= 1 },
      { id: 'tcas', label: 'TCAS', active: sel.evadeUntil > world.time, enabled: true },
      { id: 'hold', label: t('cmdHold'), active: sel.hold, enabled: true },
    ];
    hits.commands = [];
    const bw = (w - 16 * u - 5 * u * 3) / 4, bh = 34 * u, by = y + 52 * u;
    cmds.forEach((c, i) => {
      const bx = x + 8 * u + i * (bw + 5 * u);
      ctx.fillStyle = c.active ? 'rgba(90,209,165,0.95)' : c.enabled ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.06)';
      ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 12 * u); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1; ctx.stroke();
      drawCmdGlyph(ctx, c.id, bx + bw / 2, by + 12 * u, 8 * u, c.enabled ? '#fff' : 'rgba(255,255,255,0.4)');
      ctx.fillStyle = c.enabled ? '#fff' : 'rgba(255,255,255,0.4)'; ctx.font = font('800', 8.5); ctx.textAlign = 'center';
      ctx.fillText(c.label, bx + bw / 2, by + 28 * u, bw - 4 * u);
      hits.commands!.push({ id: c.id, rect: { x: bx, y: by, w: bw, h: bh } });
    });
    ctx.textAlign = 'left';

    // advice, straight under the commands: this is the line you act on
    const advColor = adv.adviceLevel >= 3 ? 'rgba(200,30,60,0.92)' : adv.adviceLevel >= 1 ? 'rgba(200,130,20,0.92)' : 'rgba(30,150,100,0.92)';
    ctx.fillStyle = advColor; ctx.beginPath(); ctx.roundRect(x + 8 * u, y + 92 * u, w - 16 * u, 38 * u, 10 * u); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = font('800', 10);
    wrapText(ctx, adv.advice, x + 16 * u, y + 108 * u, w - 32 * u, 12 * u, 2);

    // fold-out handle for the weather table
    const thY = y + 134 * u, thH = 30 * u;
    hits.wxToggle = { x: x + 8 * u, y: thY, w: w - 16 * u, h: thH };
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.beginPath(); ctx.roundRect(x + 8 * u, thY, w - 16 * u, thH, 8 * u); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.font = font('800', 9);
    ctx.fillText((t('weatherNav') || 'WEERNAVIGATIE').toUpperCase(), x + 16 * u, thY + 18.5 * u);
    // chevron: up when the table is open, down when it is folded away
    const chx = x + w - 22 * u, chy = thY + thH / 2, cr = 4.5 * u;
    ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 1.8 * u; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    if (open) { ctx.moveTo(chx - cr, chy + cr * 0.55); ctx.lineTo(chx, chy - cr * 0.55); ctx.lineTo(chx + cr, chy + cr * 0.55); }
    else { ctx.moveTo(chx - cr, chy - cr * 0.55); ctx.lineTo(chx, chy + cr * 0.55); ctx.lineTo(chx + cr, chy - cr * 0.55); }
    ctx.stroke();

    if (open) {
      const colors = ['#7cf7a0', '#ffe27a', '#ffb04d', '#ff6a6a'];
      let ry = y + 186 * u;
      for (const r of adv.rows) {
        ctx.fillStyle = colors[r.level]; ctx.beginPath(); ctx.arc(x + 18 * u, ry - 3.5 * u, 3.5 * u, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.font = font('800', 10);
        ctx.fillText(r.label, x + 27 * u, ry, 100 * u);
        ctx.fillStyle = '#fff'; ctx.font = font('700', 10);
        ctx.fillText(r.value, x + 133 * u, ry, w - 143 * u);
        ry += 15 * u;
      }
      // forecast strip
      ry += 10 * u;
      ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.font = font('800', 8.5);
      ctx.fillText((t('forecast') || 'VERWACHTING').toUpperCase(), x + 16 * u, ry + 2 * u);
      const fx0 = x + 16 * u + 68 * u, step = (w - 16 * u - 68 * u - 10 * u) / adv.forecast.length;
      adv.forecast.forEach((f, i) => {
        const fxp = fx0 + i * step + step / 2;
        drawWeatherIcon(ctx, f.kind, fxp, ry - 5 * u, 12 * u);
        ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.font = font('800', 8); ctx.textAlign = 'center';
        ctx.fillText(`${f.at === 0 ? (t('now') || 'nu') : '+' + f.at + 's'} ${f.kmh}`, fxp, ry + 11 * u);
      });
    }
    ctx.textAlign = 'left';
  }
  return hits;
}

function wrapText(ctx: Ctx, text: string, x: number, y: number, maxW: number, lineH: number, maxLines: number): void {
  const words = text.split(' ');
  let line = '', lines = 0;
  for (const wd of words) {
    const test = line ? `${line} ${wd}` : wd;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, y + lines * lineH); lines++; line = wd;
      if (lines >= maxLines - 1) break;
    } else line = test;
  }
  if (lines < maxLines) ctx.fillText(line, x, y + lines * lineH, maxW);
}

function drawCmdGlyph(ctx: Ctx, id: string, x: number, y: number, r: number, color: string): void {
  ctx.save(); ctx.translate(x, y); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = r * 0.22; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (id === 'faster' || id === 'slower') {
    // double chevrons pointing up (faster) or down (slower)
    const d = id === 'faster' ? -1 : 1;
    for (const off of [-r * 0.45, r * 0.35]) { ctx.beginPath(); ctx.moveTo(-r * 0.7, off - d * r * 0.4 * -1); ctx.lineTo(0, off + d * r * 0.5); ctx.lineTo(r * 0.7, off - d * r * 0.4 * -1); ctx.stroke(); }
  } else if (id === 'tcas') {
    // two aircraft dots diverging with arrows
    ctx.beginPath(); ctx.arc(-r * 0.35, r * 0.3, r * 0.22, 0, Math.PI * 2); ctx.arc(r * 0.35, -r * 0.3, r * 0.22, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-r * 0.35, r * 0.1); ctx.lineTo(-r * 0.35, -r * 0.7); ctx.moveTo(-r * 0.6, -r * 0.45); ctx.lineTo(-r * 0.35, -r * 0.7); ctx.lineTo(-r * 0.1, -r * 0.45); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(r * 0.35, -r * 0.1); ctx.lineTo(r * 0.35, r * 0.7); ctx.moveTo(r * 0.1, r * 0.45); ctx.lineTo(r * 0.35, r * 0.7); ctx.lineTo(r * 0.6, r * 0.45); ctx.stroke();
  } else {
    // racetrack holding pattern
    ctx.beginPath(); ctx.roundRect(-r * 0.8, -r * 0.45, r * 1.6, r * 0.9, r * 0.45); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-r * 0.1, -r * 0.75); ctx.lineTo(r * 0.2, -r * 0.45); ctx.lineTo(-r * 0.1, -r * 0.15); ctx.stroke();
  }
  ctx.restore();
}
