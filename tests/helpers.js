// Генератор синтетических рук для тестов: строим 21 точку по заданному состоянию пальцев.

const rad = (d) => (d * Math.PI) / 180;

function rotateTowardPalm(dir, angle) {
  // Поворачиваем направление в плоскости (вдоль пальца, -z) — палец сгибается к ладони.
  const l = Math.hypot(dir.x, dir.y, dir.z) || 1;
  const d = { x: dir.x / l, y: dir.y / l, z: dir.z / l };
  // базис: d и n = (0,0,-1), ортогонализованный к d
  let n = { x: 0, y: 0, z: -1 };
  const dot = d.x * n.x + d.y * n.y + d.z * n.z;
  n = { x: n.x - dot * d.x, y: n.y - dot * d.y, z: n.z - dot * d.z };
  const nl = Math.hypot(n.x, n.y, n.z) || 1;
  n = { x: n.x / nl, y: n.y / nl, z: n.z / nl };
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: d.x * c + n.x * s, y: d.y * c + n.y * s, z: d.z * c + n.z * s };
}

const add = (a, v, k) => ({ x: a.x + v.x * k, y: a.y + v.y * k, z: a.z + v.z * k });

const BASES = {
  index: { x: -0.025, y: -0.09 },
  middle: { x: 0, y: -0.095 },
  ring: { x: 0.022, y: -0.09 },
  pinky: { x: 0.042, y: -0.08 },
};
const LENS = {
  index: [0.04, 0.025, 0.02],
  middle: [0.045, 0.028, 0.022],
  ring: [0.042, 0.026, 0.02],
  pinky: [0.032, 0.02, 0.018],
};

/** state: {thumb, index, middle, ring, pinky} каждое 'up' | 'down' | 'half' */
export function makeWorldHand(state) {
  const pts = new Array(21);
  pts[0] = { x: 0, y: 0, z: 0 };
  // Большой палец
  pts[1] = { x: -0.025, y: -0.02, z: 0 };
  pts[2] = { x: -0.045, y: -0.04, z: 0 };
  if (state.thumb === 'up') {
    const dir = { x: -0.8, y: -0.6, z: 0 };
    pts[3] = add(pts[2], dir, 0.03);
    pts[4] = add(pts[3], dir, 0.025);
  } else {
    pts[3] = { x: -0.035, y: -0.06, z: -0.02 };
    pts[4] = { x: -0.015, y: -0.07, z: -0.03 };
  }
  const idx = { index: 5, middle: 9, ring: 13, pinky: 17 };
  for (const f of ['index', 'middle', 'ring', 'pinky']) {
    const s = state[f] ?? 'up';
    const angles = s === 'up' ? [4, 4, 3] : s === 'half' ? [25, 45, 25] : [75, 100, 70];
    const base = { ...BASES[f], z: 0 };
    let dir = { x: base.x, y: base.y, z: 0 };
    let p = base;
    pts[idx[f]] = p;
    for (let j = 0; j < 3; j++) {
      dir = rotateTowardPalm(dir, rad(angles[j]));
      p = add(p, dir, LENS[f][j]);
      pts[idx[f] + j + 1] = p;
    }
  }
  return pts;
}

/**
 * Собирает «результат MediaPipe» из рук. hands: [{state, cx, cy, scale}]
 * cx, cy — центр руки в кадре (0..1, координаты камеры до зеркалирования).
 */
export function makeResult(hands, aspect = 16 / 9) {
  const landmarks = [];
  const worldLandmarks = [];
  for (const h of hands) {
    const world = makeWorldHand(h.state);
    const scale = h.scale ?? 1.3;
    const img = world.map((p) => ({
      x: h.cx + (p.x * scale) / aspect,
      y: h.cy + 0.06 + p.y * scale,
      z: p.z,
    }));
    landmarks.push(img);
    worldLandmarks.push(world);
  }
  return { landmarks, worldLandmarks, handedness: [] };
}

export const SHAPES = {
  fist: { thumb: 'down', index: 'down', middle: 'down', ring: 'down', pinky: 'down' },
  open: { thumb: 'up', index: 'up', middle: 'up', ring: 'up', pinky: 'up' },
  two: { thumb: 'down', index: 'up', middle: 'up', ring: 'down', pinky: 'down' },
  shaka: { thumb: 'up', index: 'down', middle: 'down', ring: 'down', pinky: 'up' },
  point: { thumb: 'down', index: 'up', middle: 'down', ring: 'down', pinky: 'down' },
};
