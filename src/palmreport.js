// «Отчёт ладони»: две большие ладони, каждый палец окрашен по числу ошибок в бою —
// зелёный (ни одной) → жёлтый → красный (чаще всего подводил). Цифра на пальце — сколько раз.

const FINGERS = ['thumb', 'index', 'middle', 'ring', 'pinky'];
const NAMES = { thumb: 'большой', index: 'указательный', middle: 'средний', ring: 'безымянный', pinky: 'мизинец' };
const SIDES = { left: 'левая рука', right: 'правая рука' };

/** Ключи вида «left:ring» → { left: {ring: 3}, right: {...} }; «center» считаем правой рукой. */
export function groupMisses(misses = {}) {
  const out = { left: {}, right: {} };
  for (const [key, n] of Object.entries(misses)) {
    const [side, finger] = key.split(':');
    const s = side === 'left' ? 'left' : 'right';
    out[s][finger] = (out[s][finger] ?? 0) + n;
  }
  return out;
}

/** Самый «проблемный» палец: { side, finger, count } или null. */
export function worstFinger(misses = {}) {
  const g = groupMisses(misses);
  let best = null;
  for (const side of ['left', 'right']) {
    for (const [finger, count] of Object.entries(g[side])) {
      if (!best || count > best.count) best = { side, finger, count };
    }
  }
  return best;
}

export function describeWorst(misses) {
  const w = worstFinger(misses);
  if (!w) return 'Ни одной ошибки в пальцах — чистая техника.';
  const times = w.count % 10 >= 2 && w.count % 10 <= 4 && (w.count % 100 < 12 || w.count % 100 > 14) ? 'раза' : 'раз';
  return `Чаще всего подводит: ${SIDES[w.side]}, ${NAMES[w.finger]} палец — ${w.count} ${times}.`;
}

const lerp = (a, b, t) => Math.round(a + (b - a) * t);
function heat(count, max) {
  if (!count) return '#5fbf7f';
  const t = Math.min(1, count / Math.max(1, max));
  // жёлтый → красный
  return `rgb(${lerp(240, 214, t)}, ${lerp(182, 58, t)}, ${lerp(74, 40, t)})`;
}

/** Рисует две ладони на canvas (ширина ≈ 1.6 × высоты). */
export function drawPalmReport(canvas, misses = {}) {
  const ctx = canvas.getContext('2d');
  const { width: W, height: H } = canvas;
  ctx.clearRect(0, 0, W, H);
  const g = groupMisses(misses);
  const max = Math.max(1, ...Object.values(g.left), ...Object.values(g.right));
  const s = H / 290;

  const palm = (cx, side) => {
    // как в зеркале: у левой руки большой палец смотрит к центру (вправо), у правой — влево
    const dir = side === 'left' ? 1 : -1;
    const base = H * 0.64;
    const pw = 120 * s;
    const ph = 118 * s;
    ctx.fillStyle = '#efe6cf';
    ctx.strokeStyle = '#2a1f1a';
    ctx.lineWidth = 4 * s;
    ctx.beginPath();
    ctx.roundRect(cx - pw / 2, base - ph / 2, pw, ph, 30 * s);
    ctx.fill();
    ctx.stroke();
    // пальцы: x-смещение от центра ладони, длина
    const fingers = {
      index: { dx: 40, len: 92 },
      middle: { dx: 13, len: 104 },
      ring: { dx: -14, len: 96 },
      pinky: { dx: -40, len: 74 },
    };
    const label = (x, y, n) => {
      if (!n) return;
      ctx.fillStyle = '#2a1f1a';
      ctx.font = `800 ${22 * s}px Manrope, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(n), x, y);
    };
    for (const [f, { dx, len }] of Object.entries(fingers)) {
      const x = cx + dx * s * dir;
      const top = base - ph / 2 - len * s;
      ctx.fillStyle = heat(g[side][f], max);
      ctx.beginPath();
      ctx.roundRect(x - 12 * s, top, 24 * s, len * s + 14 * s, 12 * s);
      ctx.fill();
      ctx.stroke();
      label(x, top + 22 * s, g[side][f]);
    }
    // большой палец — наискосок в сторону
    ctx.save();
    ctx.translate(cx + dir * (pw / 2 - 6 * s), base + 6 * s);
    ctx.rotate(dir * -0.75);
    ctx.fillStyle = heat(g[side].thumb, max);
    ctx.beginPath();
    ctx.roundRect(-13 * s, -78 * s, 26 * s, 84 * s, 13 * s);
    ctx.fill();
    ctx.stroke();
    ctx.rotate(dir * 0.75);
    ctx.restore();
    if (g[side].thumb) {
      const tx = cx + dir * (pw / 2 + 38 * s);
      label(tx, base - 40 * s, g[side].thumb);
    }
    ctx.fillStyle = '#5d4d42';
    ctx.font = `700 ${18 * s}px Manrope, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(side === 'left' ? 'левая' : 'правая', cx, base + ph / 2 + 24 * s);
  };
  palm(W * 0.27, 'left');
  palm(W * 0.73, 'right');
}
