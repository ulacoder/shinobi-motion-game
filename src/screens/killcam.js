// Замедленный повтор добивающей печати (кадры камеры + следы пальцев) и моменты для главы манги.
// Методы подмешиваются в экран боя (src/screens/fight.js).

import { SEALS } from '../seals.js';
import { sfx } from '../audio.js';
import { $ } from '../ui.js';
import { pct, recorder, moment } from '../app/context.js';
import { drawReplayFrame } from '../replay.js';

// звук техники для манги и повтора
const TECH_SFX = { fire: 'ゴォッ!', lightning: 'バチッ!', shield: 'キィン!', sphere: 'ドドドン!', wind: 'ヒュッ!', dragon: 'ズドン!', forged: 'ドン!' };
export const REPLAY_MS = 3200; // замедленный повтор добивающей печати

export const killcam = {
  /** Запоминаем последние ~1,7 с перед техникой: если она добьёт врага — покажем её замедленно. */
  keepClip(e, now) {
    recorder.release(this.clip);
    this.clip = recorder.takeClip(1700);
    const seal = this.lastSealEv && now - this.lastSealEv.at < 2500 ? this.lastSealEv : null;
    const acc = seal ? seal.acc : e.accuracy ?? e.power;
    this.clipInfo = {
      name: e.tech.name,
      glyph: seal ? SEALS[seal.seal].kanji : e.tech.glyph ?? '印',
      detail: seal ? `${SEALS[seal.seal].name} — ${pct(acc)}` : `точность ${pct(acc)}`,
    };
  },

  /** Ключевые моменты для главы манги. */
  castMoment(e) {
    const id = e.tech.id;
    const sfx = TECH_SFX[id] ?? 'ドン!';
    if (id === 'sphere' || id === 'dragon') return moment({ caption: `${e.tech.name}!`, sfx, priority: 4, kanji: e.tech.glyph });
    if (id === 'forged') return moment({ caption: `${e.tech.name} — моя печать!`, sfx, priority: 3, once: 'forged', kanji: e.tech.glyph });
    if (e.special) return moment({ caption: `${e.special.name}!`, sfx, priority: 3, once: `sp-${e.special.name}` });
    if (e.combo >= 3) return moment({ caption: `Комбо ×${e.combo}!`, sfx, priority: 2, once: 'combo' });
    moment({ caption: `${e.tech.name}!`, sfx, priority: 2, once: 'first' });
  },

  startReplay(now) {
    if (!this.clip) return false;
    this.replay = { start: now, final: false };
    const box = $('replay');
    box.classList.remove('final');
    $('replay-name').textContent = this.clipInfo.name;
    $('replay-acc').textContent = this.clipInfo.detail;
    $('replay-hanko').textContent = this.clipInfo.glyph;
    const c = $('replay-canvas');
    const f = this.clip.frames[0].canvas;
    c.width = 720;
    c.height = Math.round((720 * f.height) / f.width);
    box.hidden = false;
    sfx.page();
    return true;
  },

  updateReplay(now) {
    const p = Math.min(1, (now - this.replay.start) / REPLAY_MS);
    // замедление: клип ~1,7 с растянут на 3,2 с, последние кадры — ещё медленнее
    const eased = Math.min(1, p < 0.7 ? p * 1.15 : 0.805 + (p - 0.7) * 0.65);
    drawReplayFrame($('replay-canvas'), this.clip, eased);
    if (p > 0.62 && !this.replay.final) {
      this.replay.final = true;
      $('replay').classList.add('final');
      sfx.seal();
    }
  },

  /** Пропустить повтор (пробел / клик). */
  skipReplay() {
    if (this.replay && this.endAt) this.endAt = performance.now();
  },
};
