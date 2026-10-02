// «Отчёт ладони»: две большие ладони в стиле иконок печатей, каждый палец окрашен по числу ошибок в бою:
// обычный цвет кожи — ни одной, золото — иногда, красная печать — чаще всего. Число над пальцем — сколько раз.

import { palmsIcon } from './icons.js';

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
/** Цвет пальца: без ошибок — обычная кожа (как на иконках печатей), дальше золото → красная печать. */
function heat(count, max) {
  if (!count) return null;
  const t = Math.min(1, count / Math.max(1, max));
  return `rgb(${lerp(240, 204, t)}, ${lerp(182, 51, t)}, ${lerp(74, 37, t)})`;
}

/** Две ладони в стиле иконок печатей: каждый палец окрашен по числу ошибок, число — над пальцем. */
export function renderPalmReport(node, misses = {}) {
  const g = groupMisses(misses);
  const max = Math.max(1, ...Object.values(g.left), ...Object.values(g.right));
  const fills = (side) => Object.fromEntries(Object.entries(g[side]).map(([f, n]) => [f, heat(n, max)]));
  node.innerHTML = palmsIcon(fills('left'), fills('right'), g);
}
