// Выбор главы руками: покажи 1, 2 или 3 пальца и держи секунду. Мышью и клавишами 1–3 тоже можно.

import { FingerChoice } from '../fingers.js';
import { music } from '../music.js';
import { sfx } from '../audio.js';
import { arena, sensei, state, registerScreen, reportFrameIssue } from '../app/context.js';
import { startStory } from '../app/story.js';

const cards = () => [...document.querySelectorAll('.chapter-card')];

export const chapters = {
  picker: new FingerChoice({ holdMs: 1000 }),

  enter() {
    this.picker.reset();
    this.lastCount = -1;
    arena.setPlace('night');
    arena.showEnemy(null);
    music.play('calm');
    music.setPlace('night');
    sensei.show('Покажи 1, 2 или 3 пальца одной рукой — это номер главы', 'info', performance.now(), { ttl: 3500 });
  },

  exit() {
    for (const c of cards()) {
      c.classList.remove('active');
      c.querySelector('.chapter-bar i').style.width = '0%';
    }
  },

  pick(chapter) {
    sfx.success();
    startStory({ chapter });
  },

  update(now) {
    const r = this.picker.update(state.hands, now);
    this.overlayTone = r.progress > 0 ? 'pass' : state.hands.length ? 'near' : 'idle';
    for (const c of cards()) {
      const n = Number(c.dataset.chapter);
      const on = r.count === n && r.progress > 0;
      c.classList.toggle('active', on);
      c.querySelector('.chapter-bar i').style.width = `${Math.round((on ? r.progress : 0) * 100)}%`;
    }
    this.lastCount = r.count;
    if (r.chosen) return this.pick(r.chosen);
    if (!reportFrameIssue(now) && r.hint) sensei.show(r.hint, 'info', now);
  },
};

for (const c of cards()) c.addEventListener('click', () => chapters.pick(Number(c.dataset.chapter)));

registerScreen('chapters', chapters);
