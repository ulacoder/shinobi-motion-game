// Распознавание круга, нарисованного указательным пальцем в воздухе.
// Свой алгоритм: центр и средний радиус, «круглость» (разброс радиуса),
// угол, который обошёл палец, и размер. Каждый параметр даёт свою подсказку.

import { clamp01, dist } from './geometry.js';

export function isPointing(hand) {
  const e = hand.ext;
  return e.index > 0.6 && e.middle < 0.45 && e.ring < 0.45 && e.pinky < 0.5;
}

export class CircleTracker {
  constructor({ minPoints = 18, maxMs = 3500, idleMs = 350 } = {}) {
    this.minPoints = minPoints;
    this.maxMs = maxMs;
    this.idleMs = idleMs;
    this.reset();
  }

  reset() {
    this.points = [];
    this.startedAt = 0;
    this.lastSeen = 0;
  }

  get drawing() {
    return this.points.length > 0;
  }

  /**
   * Кормим кадр. Возвращает результат, когда рисунок закончен (палец опущен или вышло время).
   */
  update(hands, now) {
    const pointer = hands.find(isPointing);
    if (pointer) {
      const tip = pointer.screen[8];
      if (!this.points.length) this.startedAt = now;
      const last = this.points[this.points.length - 1];
      if (!last || dist(last, tip) > 0.004) this.points.push({ x: tip.x, y: tip.y, t: now, palm: pointer.palm });
      this.lastSeen = now;
      if (now - this.startedAt > this.maxMs) return this.finish(now);
      return null;
    }
    if (this.points.length && now - this.lastSeen > this.idleMs) return this.finish(now);
    return null;
  }

  finish() {
    const pts = this.points;
    this.reset();
    if (pts.length < this.minPoints) {
      return {
        passed: false,
        accuracy: 0,
        hint: 'Рисуй круг дольше: веди указательный палец по кругу, не опуская его',
        points: pts,
      };
    }
    return scoreCircle(pts);
  }
}

/** Подгонка окружности методом наименьших квадратов (Kåsa): x²+y²+Dx+Ey+F=0. */
export function fitCircle(pts) {
  let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, sxz = 0, syz = 0, sz = 0;
  const n = pts.length;
  for (const p of pts) {
    const z = p.x * p.x + p.y * p.y;
    sx += p.x; sy += p.y; sxx += p.x * p.x; syy += p.y * p.y; sxy += p.x * p.y;
    sxz += p.x * z; syz += p.y * z; sz += z;
  }
  // Система 3x3: [sxx sxy sx; sxy syy sy; sx sy n] * [D E F] = -[sxz syz sz]
  const A = [
    [sxx, sxy, sx],
    [sxy, syy, sy],
    [sx, sy, n],
  ];
  const b = [-sxz, -syz, -sz];
  const det3 = (m) =>
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
    m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
    m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const det = det3(A);
  if (Math.abs(det) < 1e-12) return null;
  const col = (k) => A.map((row, i) => row.map((v, j) => (j === k ? b[i] : v)));
  const D = det3(col(0)) / det;
  const E = det3(col(1)) / det;
  const F = det3(col(2)) / det;
  const cx = -D / 2;
  const cy = -E / 2;
  const r2 = cx * cx + cy * cy - F;
  if (!(r2 > 0)) return null;
  return { cx, cy, r: Math.sqrt(r2) };
}

/** Оценка «насколько это круг» + конкретная подсказка, что исправить. */
export function scoreCircle(pts) {
  const n = pts.length;
  const mx = pts.reduce((s, p) => s + p.x, 0) / n;
  const my = pts.reduce((s, p) => s + p.y, 0) / n;
  const fit = fitCircle(pts);
  // Если точки почти на прямой, подгонка даёт огромный радиус — берём центр масс.
  const useFit = fit && fit.r < 2;
  const cx = useFit ? fit.cx : mx;
  const cy = useFit ? fit.cy : my;
  const radii = pts.map((p) => Math.hypot(p.x - cx, p.y - cy));
  const r = radii.reduce((s, v) => s + v, 0) / n;
  const std = Math.sqrt(radii.reduce((s, v) => s + (v - r) ** 2, 0) / n);
  const roundness = r > 0 ? std / r : 1; // 0 — идеальный круг

  // Сколько градусов обошёл палец вокруг центра.
  let sweep = 0;
  for (let i = 1; i < n; i++) {
    const a1 = Math.atan2(pts[i - 1].y - cy, pts[i - 1].x - cx);
    const a2 = Math.atan2(pts[i].y - cy, pts[i].x - cx);
    let d = a2 - a1;
    if (d > Math.PI) d -= 2 * Math.PI;
    if (d < -Math.PI) d += 2 * Math.PI;
    sweep += d;
  }
  const degrees = Math.abs((sweep * 180) / Math.PI);
  const palm = pts.reduce((s, p) => s + (p.palm || 0), 0) / n || 0.15;
  const size = r / palm; // радиус в «ладонях»
  const duration = (pts[n - 1].t - pts[0].t) / 1000;

  const sClosed = clamp01((degrees - 200) / 130); // 330°+ — замкнут
  const sRound = clamp01(1 - (roundness - 0.12) / 0.3);
  const sSize = clamp01((size - 0.35) / 0.55);
  const sSpeed = clamp01((duration - 0.25) / 0.35);
  const accuracy = sClosed * 0.4 + sRound * 0.35 + sSize * 0.15 + sSpeed * 0.1;

  const checks = [
    { score: sClosed, hint: 'Круг не замкнут: доведи линию до места, где начал' },
    { score: sRound, hint: 'Круг вышел кривым или овальным: веди палец ровнее, с одинаковым радиусом' },
    { score: sSize, hint: 'Круг слишком маленький: рисуй шире, размером с ладонь' },
    { score: sSpeed, hint: 'Слишком быстро: рисуй круг плавно, примерно за секунду' },
  ];
  const worst = checks.reduce((a, b) => (b.score < a.score ? b : a));
  const passed = accuracy >= 0.7 && checks.every((c) => c.score >= 0.45);
  return {
    passed,
    accuracy,
    hint: passed ? null : worst.hint,
    points: pts,
    details: { degrees, roundness, size, duration },
  };
}
