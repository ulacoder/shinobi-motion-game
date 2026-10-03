// «Ханко-ладонь»: подпись игрока — его лучшая печать боя (21 точка каждой руки), оттиснутая
// красной тушью как японская именная печать. Рисуется на экране итогов и на странице манги.

const SEAL = '#cc3325';
const PAPER = '#efe6cf';
const CHAINS = [
  [0, 1, 2, 3, 4],
  [0, 5, 6, 7, 8],
  [9, 10, 11, 12],
  [13, 14, 15, 16],
  [0, 17, 18, 19, 20],
];
const PALM = [0, 1, 5, 9, 13, 17];

/** Лучшая печать похода: { seal, accuracy, form } или null. */
export function bestSignature(bestForms = {}) {
  let best = null;
  for (const [seal, v] of Object.entries(bestForms)) {
    if (v?.form?.hands?.length && (!best || v.accuracy > best.accuracy)) best = { seal, accuracy: v.accuracy, form: v.form };
  }
  return best;
}

// псевдослучайные числа, чтобы «фактура» оттиска была одинаковой на итогах и в манге
function rng(seed) {
  let s = seed || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/**
 * Рисует оттиск в квадрате size×size с левым верхним углом (x, y). form — { hands: [[21 точка]] }.
 * Красная рамка с двойной линией, внутри — руки красной тушью, «выбранные» линии суставов цвета бумаги,
 * по краям — непропечатанные крапинки, как у настоящей печати.
 */
export function drawHandHanko(ctx, form, x, y, size, { rot = -0.08, seed = 7 } = {}) {
  const hands = form?.hands ?? [];
  if (!hands.length) return;
  ctx.save();
  ctx.translate(x + size / 2, y + size / 2);
  ctx.rotate(rot);
  ctx.translate(-size / 2, -size / 2);

  // рамка печати
  const r = size * 0.1;
  ctx.strokeStyle = SEAL;
  ctx.lineWidth = size * 0.05;
  ctx.beginPath();
  ctx.roundRect(size * 0.04, size * 0.04, size * 0.92, size * 0.92, r);
  ctx.stroke();
  ctx.lineWidth = size * 0.014;
  ctx.beginPath();
  ctx.roundRect(size * 0.11, size * 0.11, size * 0.78, size * 0.78, r * 0.6);
  ctx.stroke();

  // руки вписываем в рамку
  const pts = hands.flat();
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const inner = size * 0.64;
  const k = inner / Math.max(maxX - minX, maxY - minY, 1e-6);
  const ox = size / 2 - ((minX + maxX) / 2) * k;
  const oy = size / 2 - ((minY + maxY) / 2) * k;
  const P = (p) => ({ x: ox + p.x * k, y: oy + p.y * k });
  const palm = hands.reduce((s, h) => s + Math.hypot(h[9].x - h[0].x, h[9].y - h[0].y), 0) / hands.length;
  const fw = Math.max(size * 0.035, palm * k * 0.22);

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const h of hands) {
    const q = h.map(P);
    // ладонь и пальцы — сплошной красной тушью
    ctx.fillStyle = SEAL;
    ctx.strokeStyle = SEAL;
    ctx.beginPath();
    PALM.forEach((i, j) => (j ? ctx.lineTo(q[i].x, q[i].y) : ctx.moveTo(q[i].x, q[i].y)));
    ctx.closePath();
    ctx.lineWidth = fw;
    ctx.fill();
    ctx.stroke();
    for (const c of CHAINS) {
      ctx.beginPath();
      c.forEach((i, j) => (j ? ctx.lineTo(q[i].x, q[i].y) : ctx.moveTo(q[i].x, q[i].y)));
      ctx.stroke();
    }
    // «вырезанные» линии — цвет бумаги по осям пальцев, как резьба на печати
    ctx.strokeStyle = PAPER;
    ctx.lineWidth = Math.max(1.5, fw * 0.16);
    for (const c of CHAINS) {
      ctx.beginPath();
      c.slice(1).forEach((i, j) => (j ? ctx.lineTo(q[i].x, q[i].y) : ctx.moveTo(q[i].x, q[i].y)));
      ctx.stroke();
    }
  }

  // непропечатанные крапинки — фактура настоящего оттиска
  const rand = rng(seed);
  ctx.fillStyle = PAPER;
  for (let i = 0; i < 70; i++) {
    const px = rand() * size;
    const py = rand() * size;
    ctx.globalAlpha = 0.35 + rand() * 0.5;
    ctx.beginPath();
    ctx.arc(px, py, size * (0.004 + rand() * 0.01), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
