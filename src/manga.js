// «Твоя глава манги»: ключевые моменты боя (стоп-кадры камеры + руки) собираются в страницу манги
// с панелями, звуковыми надписями и репликами. Страницу можно сохранить как PNG.

import { drawHandHanko } from './hanko.js';

const PAPER = '#efe6cf';
const INK = '#1a1320';
const SEAL = '#cc3325';
const ANIME = "'Dela Gothic One', Unbounded, 'Arial Black', sans-serif";
const KANJI = "'Shippori Mincho B1', 'Yu Mincho', 'Hiragino Mincho ProN', 'Noto Serif CJK JP', serif";
const LINKS = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
];
const MAX_PANELS = 5;

/**
 * Запоминает момент боя. priority — насколько он важен для страницы (босс повержен важнее пропущенного удара).
 * still — стоп-кадр из FrameRecorder.still().
 */
export function addMoment(run, still, { caption, sfx = '', kanji = '', who = 'Улагат', priority = 1, once = null }) {
  if (!run || !still) return;
  run.moments ??= [];
  if (once && run.moments.some((m) => m.once === once)) return;
  run.moments.push({ ...still, caption, sfx, kanji, who, priority, once, at: run.moments.length });
  // держим не больше 12 кандидатов: выбрасываем наименее важный (из одинаковых — более ранний)
  if (run.moments.length > 12) {
    let worst = 0;
    run.moments.forEach((m, i) => {
      if (m.priority < run.moments[worst].priority) worst = i;
    });
    run.moments.splice(worst, 1);
  }
}

/** Лучшие моменты для страницы — по важности, но в порядке боя. */
export function pickMoments(moments = [], max = MAX_PANELS) {
  return [...moments]
    .map((m, i) => ({ m, i }))
    .sort((a, b) => b.m.priority - a.m.priority || b.i - a.i)
    .slice(0, max)
    .sort((a, b) => a.i - b.i)
    .map(({ m }) => m);
}

/** Раскладка панелей по рядам для 1–5 моментов. */
export function layoutRows(n) {
  return [[1], [1, 1], [1, 2], [1, 2, 1], [1, 2, 2]][Math.max(0, Math.min(MAX_PANELS, n) - 1)];
}

/**
 * Рисует страницу. info: { name, score, win, chapterTitle, date }.
 * Возвращает canvas 1240×1754 (пропорции A4).
 */
export function renderMangaPage(moments, info) {
  const W = 1240;
  const H = 1754;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  // бумага
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);
  paperGrain(ctx, W, H);

  // шапка: название, глава, ханко
  const M = 56;
  ctx.fillStyle = INK;
  ctx.font = `64px ${ANIME}`;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('ПУТЬ ПЕЧАТЕЙ', M, 118);
  ctx.font = `30px ${ANIME}`;
  ctx.fillStyle = SEAL;
  ctx.fillText(info.chapterTitle ?? 'Глава: бой с кланом Затмения', M, 166);
  ctx.font = `600 26px Manrope, system-ui, sans-serif`;
  ctx.fillStyle = '#5d4d42';
  ctx.fillText(`Герой — ${info.name}. Все кадры сняты камерой во время игры`, M, 206);
  hanko(ctx, W - M - 118, 58, 118, info.win ? '勝' : '印');
  // подпись игрока — его лучшая печать оттиском ханко
  if (info.signature) drawHandHanko(ctx, info.signature.form, W - M - 118 - 150, 46, 140, { rot: 0.1 });

  // панели
  const picked = pickMoments(moments);
  const rows = layoutRows(picked.length);
  const top = 240;
  const bottom = H - 110;
  const gap = 22;
  const rowH = (bottom - top - gap * (rows.length - 1)) / rows.length;
  let k = 0;
  rows.forEach((cols, r) => {
    const y0 = top + r * (rowH + gap);
    const colW = (W - 2 * M - gap * (cols - 1)) / cols;
    for (let col = 0; col < cols; col++) {
      const m = picked[k++];
      if (!m) continue;
      const x0 = M + col * (colW + gap);
      // скошенные края — как в манге: соседние панели делят один наклонный разрез
      const skew = cols > 1 ? 18 : 0;
      const poly = [
        { x: x0 + (col > 0 ? skew : 0), y: y0 },
        { x: x0 + colW + (col < cols - 1 ? skew : 0), y: y0 },
        { x: x0 + colW - (col < cols - 1 ? skew : 0), y: y0 + rowH },
        { x: x0 - (col > 0 ? skew : 0), y: y0 + rowH },
      ];
      drawPanel(ctx, m, poly, { x: x0, y: y0, w: colW, h: rowH }, k);
    }
  });

  // подвал
  ctx.fillStyle = INK;
  ctx.fillRect(0, H - 76, W, 76);
  ctx.fillStyle = PAPER;
  ctx.font = `26px ${ANIME}`;
  ctx.fillText(`${info.score} очков`, M, H - 28);
  ctx.font = `600 22px Manrope, system-ui, sans-serif`;
  ctx.textAlign = 'right';
  ctx.fillText(`Team Jacket · shinobi-motion.vercel.app · ${info.date}`, W - M, H - 30);
  ctx.textAlign = 'left';
  return c;
}

function drawPanel(ctx, m, poly, box, index) {
  ctx.save();
  ctx.beginPath();
  poly.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
  ctx.clip();

  // кадр — «cover», с центром на руках
  const src = m.canvas;
  const k = Math.max((box.w + 40) / src.width, (box.h + 10) / src.height) * 1.08;
  const dw = src.width * k;
  const dh = src.height * k;
  const hands = m.hands ?? [];
  let fx = src.width / 2;
  let fy = src.height / 2;
  if (hands.length) {
    const pts = hands.flatMap((h) => h.pts);
    fx = (pts.reduce((s, p) => s + p.x, 0) / pts.length) * src.height;
    fy = (pts.reduce((s, p) => s + p.y, 0) / pts.length) * src.height;
  }
  let ox = box.x + box.w / 2 - fx * k;
  let oy = box.y + box.h / 2 - fy * k;
  ox = Math.min(box.x - 20, Math.max(box.x + box.w + 20 - dw, ox));
  oy = Math.min(box.y, Math.max(box.y + box.h - dh, oy));
  ctx.filter = 'grayscale(1) contrast(1.55) brightness(1.08)';
  ctx.drawImage(src, ox, oy, dw, dh);
  ctx.filter = 'none';
  halftone(ctx, box);
  const P = (q) => ({ x: ox + q.x * src.height * k, y: oy + q.y * src.height * k });

  // линии скорости от рук
  const center = hands.length ? P({ x: fx / src.height, y: fy / src.height }) : { x: box.x + box.w / 2, y: box.y + box.h / 2 };
  ctx.strokeStyle = 'rgba(26,19,32,0.55)';
  ctx.lineWidth = 2;
  for (let a = 0; a < 56; a++) {
    const ang = (a / 56) * Math.PI * 2 + index;
    const r0 = Math.max(box.w, box.h) * (0.42 + ((a * 29) % 13) / 60);
    ctx.beginPath();
    ctx.moveTo(center.x + Math.cos(ang) * r0, center.y + Math.sin(ang) * r0);
    ctx.lineTo(center.x + Math.cos(ang) * box.w * 1.4, center.y + Math.sin(ang) * box.w * 1.4);
    ctx.stroke();
  }

  // руки тушью с золотыми кончиками
  ctx.lineCap = 'round';
  for (const h of hands) {
    const pts = h.pts.map(P);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 7;
    for (const [a, b] of LINKS) line(ctx, pts[a], pts[b]);
    ctx.strokeStyle = PAPER;
    ctx.lineWidth = 2.5;
    for (const [a, b] of LINKS) line(ctx, pts[a], pts[b]);
    ctx.fillStyle = '#f0b64a';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    for (const t of [4, 8, 12, 16, 20]) {
      ctx.beginPath();
      ctx.arc(pts[t].x, pts[t].y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  // звуковая надпись
  if (m.sfx) {
    ctx.save();
    const size = Math.min(110, box.h * 0.32);
    ctx.translate(box.x + box.w - size * 0.3, box.y + box.h * 0.36);
    ctx.rotate(-0.18);
    ctx.font = `${size}px ${ANIME}`;
    ctx.textAlign = 'right';
    ctx.lineJoin = 'round';
    ctx.lineWidth = size * 0.14;
    ctx.strokeStyle = PAPER;
    ctx.strokeText(m.sfx, 0, 0);
    ctx.fillStyle = SEAL;
    ctx.fillText(m.sfx, 0, 0);
    ctx.restore();
  }
  ctx.restore();

  // реплика
  if (m.caption) bubble(ctx, m.caption, m.who, box);
  if (m.kanji) hanko(ctx, box.x + 16, box.y + box.h - 86, 70, m.kanji);

  // рамка панели
  ctx.beginPath();
  poly.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 7;
  ctx.stroke();
}

function line(ctx, a, b) {
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}

/** Растровая сетка точек — типографский «скринтон» манги. */
function halftone(ctx, box) {
  ctx.save();
  ctx.fillStyle = 'rgba(26,19,32,0.16)';
  const step = 9;
  for (let y = box.y; y < box.y + box.h; y += step) {
    const shift = ((y - box.y) / step) % 2 ? step / 2 : 0;
    for (let x = box.x - 30 + shift; x < box.x + box.w + 30; x += step) {
      const r = 1.1 + 1.6 * ((y - box.y) / box.h);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** Облачко реплики: белый овал, обводка тушью, хвостик к герою. */
function bubble(ctx, text, who, box) {
  ctx.save();
  const maxW = Math.min(box.w * 0.62, 460);
  ctx.font = `28px ${ANIME}`;
  const lines = wrap(ctx, text, maxW - 56);
  const lh = 36;
  const bw = Math.min(maxW, Math.max(...lines.map((l) => ctx.measureText(l).width)) + 64);
  const bh = lines.length * lh + 58;
  const x = box.x + 24;
  const y = box.y + 22;
  ctx.fillStyle = '#fffaf0';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.ellipse(x + bw / 2, y + bh / 2, bw / 2, bh / 2, 0, 0, Math.PI * 2);
  ctx.moveTo(x + bw * 0.42, y + bh * 0.94);
  ctx.lineTo(x + bw * 0.5, y + bh + 34);
  ctx.lineTo(x + bw * 0.6, y + bh * 0.9);
  ctx.fill();
  ctx.stroke();
  // перекрываем стык хвостика
  ctx.beginPath();
  ctx.ellipse(x + bw / 2, y + bh / 2, bw / 2 - 3, bh / 2 - 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = SEAL;
  ctx.font = `600 18px Manrope, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(who, x + bw / 2, y + 30);
  ctx.fillStyle = INK;
  ctx.font = `28px ${ANIME}`;
  lines.forEach((l, i) => ctx.fillText(l, x + bw / 2, y + 30 + 34 + i * lh));
  ctx.restore();
}

function wrap(ctx, text, maxW) {
  const words = text.split(' ');
  const out = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(next).width > maxW && cur) {
      out.push(cur);
      cur = w;
    } else cur = next;
  }
  if (cur) out.push(cur);
  return out.slice(0, 3);
}

function hanko(ctx, x, y, s, glyph) {
  ctx.save();
  ctx.fillStyle = SEAL;
  ctx.beginPath();
  ctx.roundRect(x, y, s, s, s * 0.14);
  ctx.fill();
  ctx.strokeStyle = PAPER;
  ctx.lineWidth = s * 0.05;
  ctx.beginPath();
  ctx.roundRect(x + s * 0.09, y + s * 0.09, s * 0.82, s * 0.82, s * 0.08);
  ctx.stroke();
  ctx.fillStyle = PAPER;
  ctx.font = `800 ${s * 0.62}px ${KANJI}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(glyph, x + s / 2, y + s * 0.54);
  ctx.restore();
}

function paperGrain(ctx, W, H) {
  ctx.save();
  ctx.fillStyle = 'rgba(93,77,66,0.05)';
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 2600; i++) ctx.fillRect(rnd() * W, rnd() * H, 2, 2);
  ctx.restore();
}
