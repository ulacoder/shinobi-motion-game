// Удар ребром ладони («рубящий удар»): своя логика по скорости руки.
// Рука должна быть раскрытой ладонью (пальцы прямые и вместе) и резко пойти сверху вниз.
// Скорость считаем в «высотах кадра в секунду» по центру ладони между кадрами распознавания.
// Каждый неудачный удар даёт конкретную подсказку: медленно, мало замаха, вбок, кулак.

import { clamp01, dist } from './geometry.js';

/** Раскрытая ладонь «ребром»: четыре пальца прямые и сомкнуты. */
export function bladeScore(hand) {
  const e = hand.ext;
  const straight = Math.min(e.index, e.middle, e.ring, Math.max(e.pinky, e.ring * 0.9));
  // пальцы вместе: кончики указательного и мизинца недалеко друг от друга (в ладонях)
  const spread = dist(hand.screen[8], hand.screen[20]) / (hand.palm || 0.1);
  const together = clamp01(1 - (spread - 0.9) / 0.9);
  return { straight, together, score: straight * 0.75 + together * 0.25 };
}

const palmCenter = (h) => ({
  x: (h.screen[0].x + h.screen[9].x) / 2,
  y: (h.screen[0].y + h.screen[9].y) / 2,
});

export class ChopDetector {
  constructor({ minSpeed = 1.5, minDrop = 0.16, cooldownMs = 380, hintEveryMs = 1400 } = {}) {
    this.minSpeed = minSpeed;
    this.minDrop = minDrop;
    this.cooldownMs = cooldownMs;
    this.hintEveryMs = hintEveryMs;
    this.reset();
  }

  reset() {
    this.prev = null; // прошлый кадр: {x, y, t}
    this.stroke = null;
    this.lastChopAt = -Infinity;
    this.lastHintAt = -Infinity;
    this.lastStamp = null;
  }

  /**
   * hands — руки текущего кадра; stamp — время кадра распознавания (новый кадр = новый stamp).
   * Возвращает массив событий: {type:'chop', power, speed} или {type:'hint', hint}.
   */
  update(hands, now, stamp = now) {
    if (stamp === this.lastStamp) return [];
    this.lastStamp = stamp;
    const events = [];
    // берём руку, которая сейчас выше всех движется вниз, иначе — самую «ладонную»
    const hand = this.pickHand(hands);

    if (!hand) {
      // рука пропала посреди удара (смазалась от скорости) — засчитываем по тому, что успели увидеть
      if (this.stroke && stamp - this.stroke.lastT > 90) events.push(...this.finish(now));
      this.prev = null;
      return events;
    }

    const c = palmCenter(hand);
    const blade = bladeScore(hand);
    if (this.prev && stamp > this.prev.t) {
      const dt = (stamp - this.prev.t) / 1000;
      const vy = (c.y - this.prev.y) / dt;
      const vx = (c.x - this.prev.x) / dt;
      if (!this.stroke && vy > 0.25 && stamp - this.lastChopAt > this.cooldownMs) {
        this.stroke = { y0: this.prev.y, x0: this.prev.x, peak: vy, blade: blade.score, bladeInfo: blade, lastT: stamp, y: c.y, x: c.x };
      } else if (this.stroke) {
        const s = this.stroke;
        s.peak = Math.max(s.peak, vy);
        s.blade = Math.max(s.blade, blade.score);
        if (blade.score >= s.blade) s.bladeInfo = blade;
        s.lastT = stamp;
        s.y = Math.max(s.y, c.y);
        s.x = c.x;
        if (vy < 0.1) events.push(...this.finish(now));
      } else if (Math.abs(vx) > 2 && Math.abs(vy) < 0.5) {
        events.push(...this.hint(now, 'Бей сверху вниз, а не вбок: подними ладонь и резко опусти'));
      }
    }
    this.prev = { x: c.x, y: c.y, t: stamp };
    return events;
  }

  pickHand(hands) {
    if (!hands.length) return null;
    if (hands.length === 1) return hands[0];
    return hands.reduce((a, b) => (bladeScore(b).score > bladeScore(a).score ? b : a));
  }

  finish(now) {
    const s = this.stroke;
    this.stroke = null;
    if (!s) return [];
    const drop = s.y - s.y0;
    const sideways = Math.abs(s.x - s.x0);
    if (drop < 0.08) return []; // просто шевельнул рукой
    if (s.peak < 0.9 && s.blade < 0.55) return []; // спокойно опустил руку — это не удар
    if (s.blade < 0.55) {
      const b = s.bladeInfo;
      const hint = b.straight < 0.5
        ? 'Раскрой ладонь: пальцы прямые, бей ребром ладони, а не кулаком'
        : 'Сомкни пальцы вместе — ладонь как лезвие';
      return this.hint(now, hint);
    }
    if (sideways > drop * 1.4) return this.hint(now, 'Бей сверху вниз, а не вбок: подними ладонь и резко опусти');
    if (s.peak < this.minSpeed) return this.hint(now, 'Резче! Бей быстро, как топором — медленный удар не расколет');
    if (drop < this.minDrop) return this.hint(now, 'Замах шире: подними ладонь выше головы и опусти до груди');
    this.lastChopAt = now;
    const power = 0.6 + 0.4 * clamp01((s.peak - this.minSpeed) / 2.2);
    return [{ type: 'chop', power, speed: s.peak, drop }];
  }

  hint(now, text) {
    if (now - this.lastHintAt < this.hintEveryMs) return [];
    this.lastHintAt = now;
    return [{ type: 'hint', hint: text }];
  }
}
