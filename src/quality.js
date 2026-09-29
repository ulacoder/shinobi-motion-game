// Проверки условий съёмки: свет, расстояние, край кадра.
// Тоже часть «режима ошибки»: игрок сразу узнаёт, почему камера его плохо видит.

import { SIDE_NAMES } from './geometry.js';

export class BrightnessMeter {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 32;
    this.canvas.height = 18;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.value = 1;
    this.lastAt = 0;
  }

  /** Средняя яркость кадра 0..1, считаем не чаще раза в 500 мс. */
  sample(video, now) {
    if (now - this.lastAt < 500 || !video.videoWidth) return this.value;
    this.lastAt = now;
    try {
      this.ctx.drawImage(video, 0, 0, 32, 18);
      const { data } = this.ctx.getImageData(0, 0, 32, 18);
      let sum = 0;
      for (let i = 0; i < data.length; i += 4) sum += data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      this.value = sum / (data.length / 4) / 255;
    } catch {
      /* кадр ещё не готов */
    }
    return this.value;
  }
}

/**
 * Возвращает самую важную проблему съёмки или null, если всё хорошо.
 */
export function frameIssue(hands, brightness, aspect) {
  if (brightness < 0.16) {
    return { id: 'dark', hint: 'Слишком темно: включи свет или повернись лицом к окну' };
  }
  for (const h of hands) {
    const side = SIDE_NAMES[h.side];
    const { minX, maxX, maxY, minY } = h.bbox;
    if (minX < 0.02 * aspect || maxX > 0.98 * aspect || maxY > 0.985 || minY < 0.01) {
      const where = minX < 0.02 * aspect ? 'влево' : maxX > 0.98 * aspect ? 'вправо' : maxY > 0.985 ? 'вниз' : 'вверх';
      return {
        id: 'edge',
        hint: `${capitalize(side.nom)} уходит за край кадра (${where}): сдвинь её к центру`,
      };
    }
    if (h.palm < 0.06) return { id: 'far', hint: 'Руки слишком далеко: придвинься ближе к камере' };
    if (h.palm > 0.4) return { id: 'near', hint: 'Руки слишком близко: отодвинь их от камеры' };
  }
  return null;
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
