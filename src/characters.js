// Персонажи игры — свои, нарисованные кодом на canvas в аниме-стиле:
// толстый контур, заливка «под cel-shading», яркие глаза.
// Координаты: (0, 0) — центр лица, масштаб 1 ≈ портрет высотой ~260 px.


import { TAU, INK } from './char-kit.js';
import { HERO_LOOKS, drawHero, drawSensei } from './heroes.js';
import { drawScout, drawOni } from './enemies.js';
import { drawKagero } from './kagero.js';

export { HERO_LOOKS, drawHero, drawSensei, drawScout, drawOni };

export function drawCharacter(ctx, who, t, opts = {}) {
  if (who === 'hero') return drawHero(ctx, t, opts);
  if (HERO_LOOKS[who]) return drawHero(ctx, t, { ...opts, hero: who });
  if (who === 'sensei') return drawSensei(ctx, t);
  if (who === 'scout') return drawScout(ctx, t, opts);
  if (who === 'oni') return drawOni(ctx, t, opts);
  if (who === 'warlord') return drawKagero(ctx, t, opts);
}

/**
 * Портрет в рамке для диалогов и HUD: фон-«манга» с линиями скорости и персонаж по грудь.
 */
export function drawPortrait(canvas, who, { t = 0, tint, mood, bg = '#2b2f6a', lines = true, close = false } = {}) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.save();
  ctx.clearRect(0, 0, w, h);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, bg);
  g.addColorStop(1, '#0f1030');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // свет за головой — персонаж отделяется от фона
  const rim = ctx.createRadialGradient(w / 2, h * 0.42, 0, w / 2, h * 0.42, w * 0.6);
  rim.addColorStop(0, 'rgba(255,240,210,0.28)');
  rim.addColorStop(1, 'rgba(255,240,210,0)');
  ctx.fillStyle = rim;
  ctx.fillRect(0, 0, w, h);
  // полутоновые точки, как в манге
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  const step = Math.max(6, Math.round(w / 34));
  for (let y = 0; y < h; y += step) {
    for (let x = (y / step) % 2 ? step / 2 : 0; x < w; x += step) {
      const r = (step / 2) * (y / h) * 0.8;
      if (r < 0.4) continue;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
    }
  }
  if (lines) {
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * TAU;
      ctx.beginPath();
      ctx.moveTo(w / 2 + Math.cos(a) * w * 0.25, h * 0.45 + Math.sin(a) * h * 0.25);
      ctx.lineTo(w / 2 + Math.cos(a) * w, h * 0.45 + Math.sin(a) * h);
      ctx.stroke();
    }
  }
  // иконка в HUD — крупный план лица; в диалоге — по грудь
  const zoom = close ? 1.5 : 1;
  const s = (Math.min(w, h) / 300) * (who === 'warlord' ? 0.72 : who === 'oni' ? 0.85 : 1) * zoom;
  const offsetY = close ? (who === 'warlord' ? 0.66 : who === 'oni' ? 0.58 : who === 'scout' ? 0.56 : 0.62) : who === 'warlord' ? 0.6 : who === 'scout' ? 0.46 : who === 'oni' ? 0.56 : 0.5;
  ctx.save();
  ctx.translate(w / 2, h * offsetY);
  ctx.scale(s, s);
  drawCharacter(ctx, who, t, { tint, mood });
  ctx.restore();
  if (close) {
    // рамка-оттиск: тушь и тонкая золотая линия внутри
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(3, w * 0.05);
    ctx.strokeRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(240,182,74,0.9)';
    ctx.lineWidth = Math.max(1.5, w * 0.018);
    const inset = w * 0.06;
    ctx.strokeRect(inset, inset, w - inset * 2, h - inset * 2);
  }
  ctx.restore();
}
