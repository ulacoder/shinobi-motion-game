// Руки героя: рука игрока, нарисованная в стиле иконок печатей (телесная заливка, обводка тушью).
// Герой на арене складывает печати теми же пальцами, что и игрок перед камерой (вид от первого лица,
// как в аниме). Точки берутся из MediaPipe (21 точка), поэтому каждый палец повторяется честно.

const INK = '#2a1f1a';
const SKIN = '#f3d9bd';
const SHADE = '#e2bf9c';

const FINGERS = [
  [1, 2, 3, 4],
  [5, 6, 7, 8],
  [9, 10, 11, 12],
  [13, 14, 15, 16],
  [17, 18, 19, 20],
];
const PALM = [0, 1, 5, 9, 13, 17];
const TIPS = [4, 8, 12, 16, 20];

/** Плавное следование за рукой: убирает дрожь распознавания, но не запаздывает заметно. */
export class HandSmoother {
  constructor(k = 0.45) {
    this.k = k;
    this.bySide = new Map();
  }

  update(hands) {
    const out = [];
    const seen = new Set();
    for (const h of hands) {
      const key = h.side ?? out.length;
      seen.add(key);
      const prev = this.bySide.get(key);
      const pts = prev
        ? h.screen.map((p, i) => ({ x: prev[i].x + (p.x - prev[i].x) * this.k, y: prev[i].y + (p.y - prev[i].y) * this.k }))
        : h.screen.map((p) => ({ x: p.x, y: p.y }));
      this.bySide.set(key, pts);
      out.push(pts);
    }
    for (const key of [...this.bySide.keys()]) if (!seen.has(key)) this.bySide.delete(key);
    return out;
  }
}

/**
 * Рисует руки героя. hands — массивы по 21 точке (экранные координаты камеры),
 * box — куда вписать: { x, y, w, h } (низ рамки — «от первого лица», руки поднимаются снизу).
 * glow — цвет свечения (печать засчитана / почти), alpha — прозрачность (появление).
 */
export function drawHeroHands(ctx, hands, box, { glow = null, alpha = 1, palmK = 1 } = {}) {
  if (!hands.length || alpha <= 0.01) return;
  const all = hands.flat();
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of all) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  // масштаб — по размеру ладони, чтобы руки не «прыгали», когда пальцы сгибаются
  const palm = hands.reduce((s, h) => s + Math.hypot(h[9].x - h[0].x, h[9].y - h[0].y), 0) / hands.length || 0.1;
  const scale = Math.min((box.h * 0.36 * palmK) / palm, (box.w * 0.9) / (maxX - minX || 1));
  const cx = (minX + maxX) / 2;
  const P = (p) => ({ x: box.x + box.w / 2 + (p.x - cx) * scale, y: box.y + box.h - (maxY - p.y) * scale * 0.98 + box.h * 0.12 });
  const W = palm * scale; // длина ладони в пикселях
  const fw = W * 0.2; // толщина пальца

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const shapes = hands.map((h) => h.map(P));

  // 1) тушь: вся рука чуть толще — получится обводка
  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
  if (glow) {
    ctx.shadowColor = glow;
    ctx.shadowBlur = W * 0.35;
  }
  for (const pts of shapes) {
    palmPath(ctx, pts);
    ctx.lineWidth = fw + W * 0.07;
    ctx.stroke();
    ctx.fill();
    for (const chain of FINGERS) strokeChain(ctx, pts, chain, fw * (chain[0] === 1 ? 1.12 : 1) + W * 0.07);
  }
  ctx.shadowBlur = 0;

  // 2) кожа поверх
  ctx.strokeStyle = SKIN;
  ctx.fillStyle = SKIN;
  for (const pts of shapes) {
    palmPath(ctx, pts);
    ctx.lineWidth = fw;
    ctx.stroke();
    ctx.fill();
    for (const chain of FINGERS) strokeChain(ctx, pts, chain, fw * (chain[0] === 1 ? 1.12 : 1));
  }

  // 3) лёгкая тень на ладони и складки суставов — тушью, тонко
  ctx.strokeStyle = SHADE;
  ctx.lineWidth = fw * 0.35;
  for (const pts of shapes) {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    ctx.quadraticCurveTo(pts[13].x, pts[13].y, pts[17].x, pts[17].y);
    ctx.stroke();
  }
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(1.2, W * 0.018);
  for (const pts of shapes) {
    for (const chain of FINGERS) {
      for (const j of [chain[1], chain[2]]) crease(ctx, pts, j, fw * 0.32);
    }
  }
  // 4) ногти-кончики золотом, когда печать засчитана
  if (glow) {
    ctx.fillStyle = '#f0b64a';
    for (const pts of shapes) {
      for (const i of TIPS) {
        ctx.beginPath();
        ctx.arc(pts[i].x, pts[i].y, fw * 0.22, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.restore();
}

function palmPath(ctx, pts) {
  ctx.beginPath();
  PALM.forEach((i, k) => (k ? ctx.lineTo(pts[i].x, pts[i].y) : ctx.moveTo(pts[i].x, pts[i].y)));
  ctx.closePath();
}

function strokeChain(ctx, pts, chain, width) {
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(pts[chain[0]].x, pts[chain[0]].y);
  for (let i = 1; i < chain.length; i++) ctx.lineTo(pts[chain[i]].x, pts[chain[i]].y);
  ctx.stroke();
}

/** Короткая складка поперёк фаланги в суставе j. */
function crease(ctx, pts, j, half) {
  const a = pts[j - 1];
  const b = pts[j + 1];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l = Math.hypot(dx, dy) || 1;
  const nx = (-dy / l) * half;
  const ny = (dx / l) * half;
  ctx.beginPath();
  ctx.moveTo(pts[j].x - nx * 0.6, pts[j].y - ny * 0.6);
  ctx.lineTo(pts[j].x + nx * 0.6, pts[j].y + ny * 0.6);
  ctx.stroke();
}
