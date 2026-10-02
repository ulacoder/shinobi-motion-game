// Счёт пальцев: «покажи 1, 2 или 3 пальца» — выбор главы без мыши.
// Палец считается поднятым, если он выпрямлен (та же «выпрямленность» 0..1 из углов суставов).
// Неважно, как именно показывать «3»: указательный+средний+безымянный или большой+указательный+средний.

import { FINGERS } from './geometry.js';

/** Сколько пальцев поднято на руке (0–5). */
export function countFingers(hand) {
  let n = 0;
  for (const f of FINGERS) if (hand.ext[f] > 0.6) n += 1;
  return n;
}

/**
 * Выбор числом пальцев: одно и то же число держится holdMs — выбор сделан.
 * Следующий выбор — только после того, как руку опустили или число сменилось.
 */
export class FingerChoice {
  constructor({ holdMs = 1000, allowed = [1, 2, 3] } = {}) {
    this.holdMs = holdMs;
    this.allowed = allowed;
    this.reset();
  }

  reset() {
    this.current = 0;
    this.since = 0;
    this.locked = false;
  }

  /** Возвращает { count, progress 0..1, chosen: число или null, hint }. */
  update(hands, now) {
    if (hands.length !== 1) {
      this.current = 0;
      this.since = 0;
      this.locked = false;
      return {
        count: 0,
        progress: 0,
        chosen: null,
        hint: hands.length ? 'Покажи пальцы одной рукой — вторую опусти' : 'Подними одну руку и покажи 1, 2 или 3 пальца',
      };
    }
    const count = countFingers(hands[0]);
    if (count !== this.current) {
      this.current = count;
      this.since = now;
      this.locked = false;
    }
    const ok = this.allowed.includes(count);
    const progress = ok && !this.locked ? Math.min(1, (now - this.since) / this.holdMs) : 0;
    let chosen = null;
    if (ok && !this.locked && progress >= 1) {
      chosen = count;
      this.locked = true;
    }
    const word = count === 4 ? 'четыре пальца' : 'пять пальцев';
    const hint = ok ? null : count === 0 ? 'Это кулак: подними 1, 2 или 3 пальца' : `Это ${word} — для глав нужно 1, 2 или 3`;
    return { count, progress, chosen, hint };
  }
}

/**
 * Знак «окей»: кончики большого и указательного сомкнуты кольцом, остальные три пальца прямые.
 * Обе руки «окей» — жест «в меню»: случайно так руки не держат, и это не одна из печатей.
 */
export function isOkSign(hand) {
  const e = hand.ext;
  const p = hand.screen;
  const pinch = Math.hypot(p[4].x - p[8].x, p[4].y - p[8].y) / (hand.palm || 0.1);
  return pinch < 0.38 && e.middle > 0.55 && e.ring > 0.55 && e.pinky > 0.5;
}
