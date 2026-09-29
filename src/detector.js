// Превращает поток кадров в события «печать сложена» и «почти получилось — вот подсказка».
// Защищает от дрожания: печать нужно удержать, а повтор той же печати засчитывается
// только после того, как руки её «отпустили».

import { classify, evaluateSeal, NEAR_ACCURACY, SEAL_ORDER } from './seals.js';

export class SealDetector {
  constructor({ holdMs = 380, hintDelayMs = 650, releaseMs = 250 } = {}) {
    this.holdMs = holdMs;
    this.hintDelayMs = hintDelayMs;
    this.releaseMs = releaseMs;
    this.reset();
  }

  reset() {
    this.candidate = null; // печать, которую сейчас держат
    this.candidateSince = 0;
    this.accSamples = [];
    this.locked = null; // только что засчитанная печать — ждём, пока её отпустят
    this.lockReleaseAt = 0;
    this.near = null;
    this.nearSince = 0;
    this.smoothed = {}; // сглаженная точность по каждой печати
  }

  /**
   * @param hands руки из buildHands
   * @param now время в мс
   * @param target если задано — оцениваем только эту печать (режим обучения)
   * @returns {{best, events: Array}}
   */
  update(hands, now, target = null) {
    const events = [];
    const evals = target ? [evaluateSeal(target, hands)] : classify(hands, SEAL_ORDER);

    // Сглаживаем точность, чтобы проценты не прыгали каждый кадр.
    for (const e of evals) {
      const prev = this.smoothed[e.seal] ?? e.accuracy;
      const s = prev + (e.accuracy - prev) * 0.45;
      this.smoothed[e.seal] = s;
      e.smooth = s;
    }
    const best = evals[0];
    const passing = evals.find((e) => e.passed) ?? null;

    // Разблокировка: печать отпустили или сменили.
    if (this.locked) {
      if (!passing || passing.seal !== this.locked) {
        if (!this.lockReleaseAt) this.lockReleaseAt = now;
        if (now - this.lockReleaseAt >= this.releaseMs) {
          this.locked = null;
          this.lockReleaseAt = 0;
        }
      } else {
        this.lockReleaseAt = 0;
      }
    }

    if (passing && passing.seal !== this.locked) {
      if (this.candidate !== passing.seal) {
        this.candidate = passing.seal;
        this.candidateSince = now;
        this.accSamples = [];
      }
      this.accSamples.push(passing.accuracy);
      const held = now - this.candidateSince;
      if (held >= this.holdMs) {
        const accuracy = this.accSamples.reduce((a, b) => a + b, 0) / this.accSamples.length;
        events.push({ type: 'seal', seal: passing.seal, accuracy, evaluation: passing });
        this.locked = passing.seal;
        this.lockReleaseAt = 0;
        this.candidate = null;
        this.accSamples = [];
      } else {
        events.push({ type: 'holding', seal: passing.seal, progress: held / this.holdMs });
      }
      this.near = null;
    } else {
      if (!passing) {
        this.candidate = null;
        this.accSamples = [];
      }
      // «Почти»: игрок явно пытается сложить печать, но что-то не так.
      const tryingSeal = best && best.accuracy >= NEAR_ACCURACY && !best.passed ? best : null;
      const tryingTarget = target && best && !best.passed ? best : null;
      const trying = tryingTarget ?? tryingSeal;
      if (trying && !(this.locked && trying.seal === this.locked)) {
        if (this.near !== trying.seal) {
          this.near = trying.seal;
          this.nearSince = now;
        } else if (now - this.nearSince >= this.hintDelayMs && trying.hint) {
          events.push({ type: 'hint', seal: trying.seal, hint: trying.hint, evaluation: trying });
        }
      } else {
        this.near = null;
      }
    }

    return { best, evals, events };
  }
}
