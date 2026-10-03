// Общее для фонов: палитры сцен, детерминированный random, цвет с прозрачностью.

export const TAU = Math.PI * 2;

/** Детерминированный генератор случайных чисел: фон одинаковый при каждой перерисовке. */
export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}

/** Сцены: цвета слоёв от дальнего к ближнему, дымка, подсветка гребней. */
export const SCENES = {
  night: { layers: ['#2a2f6e', '#20245a', '#171a44', '#0f1130'], fog: '#3a3f86', rim: '#9aa6ff', snow: true },
  forest: { layers: ['#2f6052', '#22493f', '#17352e', '#0d2420'], fog: '#5f8f6f', rim: '#ffcf8a' },
  bridge: { layers: ['#7a3d63', '#5c2b4f', '#43203d', '#2a1426'], fog: '#d9727a', rim: '#ffc48a' },
  eclipse: { layers: ['#3a0d1c', '#2a0914', '#1c060e', '#100308'], fog: '#7a1b26', rim: '#ff6a4a' },
  dawn: { layers: ['#b69ad0', '#9a82c0', '#7a68a8', '#5a4a86'], fog: '#f2c2b2', rim: '#fff0d0' },
};
