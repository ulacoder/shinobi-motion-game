// Геометрия руки: из 21 точки MediaPipe получаем понятные признаки —
// насколько согнут каждый палец, где рука в кадре, какого она размера.
// Всё написано вручную, без готовых классификаторов жестов.

export const FINGERS = ['thumb', 'index', 'middle', 'ring', 'pinky'];

export const FINGER_NAMES = {
  thumb: 'большой палец',
  index: 'указательный палец',
  middle: 'средний палец',
  ring: 'безымянный палец',
  pinky: 'мизинец',
};

// Индексы точек MediaPipe: 0 — запястье, далее по 4 точки на палец (от основания к кончику).
const CHAINS = {
  thumb: [1, 2, 3, 4],
  index: [5, 6, 7, 8],
  middle: [9, 10, 11, 12],
  ring: [13, 14, 15, 16],
  pinky: [17, 18, 19, 20],
};

// Пороги сгиба (0 — палец прямой, 1 — полностью согнут).
export const BEND_STRAIGHT = 0.3;
export const BEND_CURLED = 0.55;

const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: (a.z ?? 0) - (b.z ?? 0) });
const len = (v) => Math.hypot(v.x, v.y, v.z);
export const dist = (a, b) => len(sub(a, b));
export const clamp01 = (v) => Math.max(0, Math.min(1, v));

function angleBetween(u, v) {
  const lu = len(u);
  const lv = len(v);
  if (lu === 0 || lv === 0) return 0;
  const cos = (u.x * v.x + u.y * v.y + u.z * v.z) / (lu * lv);
  return Math.acos(Math.max(-1, Math.min(1, cos)));
}

/** Суммарный сгиб пальца в суставах, нормированный: ~0.1 прямой, ~1 кулак. */
export function fingerBend(pts, finger) {
  const [a, b, c, d] = CHAINS[finger].map((i) => pts[i]);
  if (finger === 'thumb') {
    // У большого пальца смотрим на изгиб двух верхних суставов.
    const total = angleBetween(sub(b, a), sub(c, b)) + angleBetween(sub(c, b), sub(d, c));
    return clamp01(total / Math.PI);
  }
  const wrist = pts[0];
  const total =
    angleBetween(sub(a, wrist), sub(b, a)) +
    angleBetween(sub(b, a), sub(c, b)) +
    angleBetween(sub(c, b), sub(d, c));
  return clamp01(total / Math.PI);
}

/**
 * Насколько большой палец отведён от ладони (0 — прижат, 1 — отставлен).
 * Сгиб для него ненадёжен, поэтому меряем расстояние от кончика до основания указательного.
 */
export function thumbOpenness(pts) {
  const palm = dist(pts[0], pts[9]) || 1;
  const d = dist(pts[4], pts[5]) / palm;
  const straight = 1 - fingerBend(pts, 'thumb');
  return clamp01(((d - 0.45) / 0.45) * 0.75 + straight * 0.25);
}

/**
 * «Выпрямленность» пальца от 0 до 1 — главный признак для правил печатей.
 */
export function fingerExtension(pts, finger) {
  if (finger === 'thumb') return thumbOpenness(pts);
  const bend = fingerBend(pts, finger);
  return clamp01((BEND_CURLED - bend) / (BEND_CURLED - BEND_STRAIGHT));
}

/**
 * Превращает сырой результат MediaPipe в список рук с признаками.
 * aspect = ширина/высота видео, чтобы расстояния по X и Y были сравнимы.
 * Сторона руки определяется по положению в зеркальном кадре — так, как её видит игрок.
 */
export function buildHands(result, aspect = 16 / 9) {
  const hands = [];
  const list = result?.landmarks ?? [];
  for (let i = 0; i < list.length; i++) {
    const img = list[i];
    const world = result.worldLandmarks?.[i] ?? img;
    // Зеркалим X: игрок видит себя как в зеркале.
    const screen = img.map((p) => ({ x: (1 - p.x) * aspect, y: p.y, z: p.z }));
    const ext = {};
    for (const f of FINGERS) ext[f] = fingerExtension(world, f);
    const xs = screen.map((p) => p.x);
    const ys = screen.map((p) => p.y);
    hands.push({
      img,
      world,
      screen,
      ext,
      wrist: screen[0],
      center: screen[9],
      palm: dist(screen[0], screen[9]),
      bbox: { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) },
      side: 'center',
      aspect,
    });
  }
  // Сторона руки: по положению на экране, а не по «handedness» MediaPipe,
  // которая путается при зеркальной камере и у левшей.
  if (hands.length === 2) {
    const [a, b] = hands;
    const left = a.center.x <= b.center.x ? a : b;
    const right = left === a ? b : a;
    left.side = 'left';
    right.side = 'right';
  } else if (hands.length === 1) {
    hands[0].side = hands[0].center.x < aspect / 2 ? 'left' : 'right';
  }
  return hands;
}

export const SIDE_NAMES = {
  left: { nom: 'левая рука', acc: 'левую руку', prep: 'левой руке' },
  right: { nom: 'правая рука', acc: 'правую руку', prep: 'правой руке' },
  center: { nom: 'рука', acc: 'руку', prep: 'руке' },
};
