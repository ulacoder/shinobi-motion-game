// Рука-призрак: «правильная» форма руки, построенная прямо из руки игрока.
// Пальцы, которые сложены верно, остаются как есть; неверные — перестраиваются в нужное положение
// (выпрямленными вдоль ладони или согнутыми к ней). Так призрак всегда совпадает с рукой по месту,
// размеру и повороту, и игрок видит, куда «дотянуть» палец.

const CHAINS = {
  thumb: [1, 2, 3, 4],
  index: [5, 6, 7, 8],
  middle: [9, 10, 11, 12],
  ring: [13, 14, 15, 16],
  pinky: [17, 18, 19, 20],
};
// длины фаланг в долях «ладони» (запястье → основание среднего пальца)
const BONES = { index: [0.42, 0.26, 0.2], middle: [0.46, 0.29, 0.22], ring: [0.43, 0.27, 0.2], pinky: [0.34, 0.21, 0.18] };
const SPREAD = { index: 0.12, middle: 0, ring: -0.1, pinky: -0.2 };

const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
const add = (a, v, k = 1) => ({ x: a.x + v.x * k, y: a.y + v.y * k });
const norm = (v) => {
  const l = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / l, y: v.y / l };
};
const rot = (v, a) => ({ x: v.x * Math.cos(a) - v.y * Math.sin(a), y: v.x * Math.sin(a) + v.y * Math.cos(a) });

/**
 * pts — 21 точка руки на экране; wants — { finger: 'up' | 'down' } для пальцев, которые надо исправить.
 * Возвращает 21 точку руки-призрака.
 */
export function guideHand(pts, wants) {
  const out = pts.map((p) => ({ x: p.x, y: p.y }));
  const wrist = pts[0];
  const palm = Math.hypot(pts[9].x - wrist.x, pts[9].y - wrist.y) || 0.1;
  const axis = norm(sub(pts[9], wrist)); // от запястья к пальцам
  // с какой стороны большой палец — чтобы «развести» пальцы правильно для левой и правой руки
  const side = Math.sign(axis.x * (pts[5].y - pts[17].y) - axis.y * (pts[5].x - pts[17].x)) || 1;

  for (const [finger, want] of Object.entries(wants)) {
    const idx = CHAINS[finger];
    if (!idx || !want) continue;
    if (finger === 'thumb') {
      const base = pts[2];
      if (want === 'up') {
        // отставленный большой палец: в сторону от ладони
        const dir = norm(add(norm(sub(pts[2], pts[1])), rot(axis, side * 0.9), 0.6));
        out[3] = add(base, dir, palm * 0.32);
        out[4] = add(base, dir, palm * 0.58);
      } else {
        // прижатый: кончик у основания указательного
        out[3] = add(base, sub(pts[5], base), 0.55);
        out[4] = add(pts[5], axis, -palm * 0.12);
      }
      continue;
    }
    const mcp = pts[idx[0]];
    const dir = rot(axis, side * SPREAD[finger]);
    const [l1, l2, l3] = BONES[finger].map((k) => k * palm);
    if (want === 'up') {
      out[idx[1]] = add(mcp, dir, l1);
      out[idx[2]] = add(mcp, dir, l1 + l2);
      out[idx[3]] = add(mcp, dir, l1 + l2 + l3);
    } else {
      // согнутый палец: фаланги складываются к ладони
      const pip = add(mcp, dir, l1 * 0.75);
      const back = rot(dir, side * 2.4);
      out[idx[1]] = pip;
      out[idx[2]] = add(pip, back, l2 * 0.8);
      out[idx[3]] = add(out[idx[2]], rot(back, side * 0.9), l3 * 0.8);
    }
  }
  return out;
}

/** Какие пальцы и как исправить, по правилам оценки печати (или эталона Кузницы). Ключ — сторона руки. */
export function wantsBySide(evaluation) {
  const map = new Map();
  for (const r of evaluation?.rules ?? []) {
    if (r.kind !== 'finger' || r.score >= 0.5) continue;
    const want = r.want ?? (r.target >= 0.5 ? 'up' : 'down');
    if (!map.has(r.side)) map.set(r.side, {});
    map.get(r.side)[r.finger] = want;
  }
  return map;
}
