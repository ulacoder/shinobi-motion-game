// Иконки: как складывать каждую печать (SVG рук, строится из правил печати)
// и значки техник. Всё рисуется кодом.

import { SEALS } from './seals.js';

const INK = '#2a1f1a';
const SKIN = '#f3d9bd';

/**
 * Одна рука в SVG. fingers: {thumb, index, middle, ring, pinky} = 'up' | 'down' | null.
 * Центр ладони — (cx, cy), ладонь смотрит на зрителя, пальцы вверх.
 */
function hand(fingers, cx, cy, { mirror = false, scale = 1 } = {}) {
  const f = (name) => fingers[name] ?? 'down';
  const s = scale;
  const dir = mirror ? -1 : 1;
  const parts = [];
  // ладонь
  parts.push(`<rect x="${cx - 15 * s}" y="${cy - 12 * s}" width="${30 * s}" height="${28 * s}" rx="${8 * s}" />`);
  // четыре пальца: указательный ближе к большому
  const order = ['index', 'middle', 'ring', 'pinky'];
  const lens = { index: 22, middle: 25, ring: 23, pinky: 18 };
  order.forEach((name, i) => {
    const x = cx + dir * (-11.5 + i * 7.6) * s - 3.3 * s;
    const up = f(name) === 'up';
    const len = (up ? lens[name] : 7) * s;
    parts.push(`<rect x="${x}" y="${cy - 12 * s - len + 4 * s}" width="${6.6 * s}" height="${len}" rx="${3.3 * s}" />`);
  });
  // большой палец
  const thumbUp = f('thumb') === 'up';
  if (thumbUp) {
    const tx = cx + dir * -13 * s;
    const ty = cy + 4 * s;
    parts.push(
      `<rect x="${tx - 3.5 * s}" y="${ty - 20 * s}" width="${7 * s}" height="${20 * s}" rx="${3.5 * s}" transform="rotate(${dir * -48} ${tx} ${ty})" />`,
    );
  } else {
    // прижат поперёк ладони
    const x = dir === 1 ? cx - 14 * s : cx - 2 * s;
    parts.push(`<rect x="${x}" y="${cy + 1 * s}" width="${16 * s}" height="${7 * s}" rx="${3.5 * s}" />`);
  }
  return parts.join('');
}

const FIST = { thumb: 'down', index: 'down', middle: 'down', ring: 'down', pinky: 'down' };

/** SVG-иконка печати: как держать обе руки. */
export function sealIcon(sealId, { size = 64, title = true } = {}) {
  const seal = SEALS[sealId];
  let body = '';
  if (sealId === 'dragon') {
    body = hand(FIST, 50, 64, { scale: 1 }) + hand(seal.roles[1].fingers, 50, 34, { scale: 0.95 });
  } else if (sealId === 'dog') {
    body = hand(FIST, 30, 56) + hand(seal.roles[1].fingers, 70, 56, { mirror: true });
  } else {
    body = hand(seal.roles[0].fingers, 28, 56) + hand(seal.roles[1].fingers, 72, 56, { mirror: true });
  }
  return `<svg class="seal-icon" viewBox="-10 -4 120 90" width="${size}" height="${Math.round(size * 0.86)}" role="img" aria-label="${seal.name}">
    ${title ? `<title>${seal.name}: ${seal.how}</title>` : ''}
    <g fill="${SKIN}" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round">${body}</g>
  </svg>`;
}

/** Значки техник. */
export function techIcon(id, size = 34) {
  const wrap = (bg, inner) =>
    `<svg class="tech-icon" viewBox="0 0 40 40" width="${size}" height="${size}" aria-hidden="true"><circle cx="20" cy="20" r="19" fill="${bg}" stroke="${INK}" stroke-width="2"/>${inner}</svg>`;
  if (id === 'fire') {
    return wrap(
      '#e8552e',
      `<path d="M20 7c2 6 9 8 9 16a9 9 0 0 1-18 0c0-5 3-7 4-10 1 3 2 5 4 5-1-4 0-8 1-11z" fill="#ffd166" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/><path d="M20 21c2 2 4 3 4 6a4 4 0 0 1-8 0c0-2 2-3 4-6z" fill="#fff4cc"/>`,
    );
  }
  if (id === 'lightning') {
    return wrap('#3b4fc4', `<path d="M23 6 12 22h7l-3 12 12-17h-7z" fill="#fff2a8" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>`);
  }
  if (id === 'shield') {
    return wrap(
      '#1f8fb8',
      `<path d="M20 8c4 5 9 9 9 15a9 9 0 0 1-18 0c0-6 5-10 9-15z" fill="#bfefff" stroke="${INK}" stroke-width="1.8"/><path d="M15 23a5 5 0 0 0 4 5" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/>`,
    );
  }
  if (id === 'wind') {
    return wrap(
      '#3f9a6e',
      `<path d="M9 26c6-1 13-7 16-17" fill="none" stroke="#eafff4" stroke-width="3.2" stroke-linecap="round"/><path d="M14 31c7-2 13-8 17-16" fill="none" stroke="#eafff4" stroke-width="3.2" stroke-linecap="round"/><path d="M9 26c6-1 13-7 16-17M14 31c7-2 13-8 17-16" fill="none" stroke="${INK}" stroke-width="1" stroke-linecap="round" opacity="0.5"/>`,
    );
  }
  if (id === 'dragon') {
    return wrap(
      '#b8322a',
      `<path d="M10 28c3-6 8-4 10-9s-2-8 3-11c3-2 7 0 8 3-2-1-4-1-5 1 3 1 4 4 2 6-3 3-6 1-8 5s1 8-4 10c-3 1-5 0-6-5z" fill="#ffd166" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/><circle cx="26" cy="11" r="1.2" fill="${INK}"/>`,
    );
  }
  // сфера
  return wrap(
    '#58d0ff',
    `<circle cx="20" cy="20" r="9" fill="#e9fbff" stroke="${INK}" stroke-width="1.8"/><ellipse cx="20" cy="20" rx="15" ry="5" fill="none" stroke="#fff" stroke-width="2" transform="rotate(-25 20 20)"/><ellipse cx="20" cy="20" rx="15" ry="5" fill="none" stroke="#fff" stroke-width="2" transform="rotate(35 20 20)"/>`,
  );
}
